# Odin-Book — Design

A Threads/X-style social network: text and image posts, an asymmetric follow
graph with follow requests, likes, comments, a personalised feed, and real-time
notifications.

## Architecture

```
   ┌──────────────┐    HTTPS / JSON     ┌───────────────────────────┐      ┌──────────────┐
   │  React SPA   │ ──────────────────▶ │   Express API (stateless) │ ───▶ │  PostgreSQL  │
   │   (Vercel)   │ ◀────────────────── │   route → middleware →    │      │    (Neon)    │
   │              │   Bearer <JWT>      │   controller → service →  │      └──────────────┘
   │              │ ◀═══ wss:// ═══════ │   prisma   + Socket.io    │
   └──────────────┘   notifications     └───────────────────────────┘
                                                     │
                                                     ▼
                                              Cloudinary (images)
```

The API holds no in-memory session state, so any request can be served by any
instance and scaling is "run more containers". That is the reason for JWT over
server-side sessions.

### Layers

| Layer      | Responsibility                                              |
| ---------- | ----------------------------------------------------------- |
| route      | URL, verb, middleware wiring                                |
| middleware | authentication, validation, uploads, error handling         |
| controller | HTTP only — parse `req`, call a service, shape the response |
| service    | business rules, authorisation, transactions                 |
| prisma     | data access                                                 |

Business rules live in services so they are testable without HTTP, and so a
second caller — the Socket.io layer, a background job, a CLI — can reuse them
unchanged. Controllers are two or three lines each and contain no `try/catch`:
services throw typed errors and a single error-handling middleware turns them
into responses.

## Data model

Two graphs that meet only in the feed query.

**Social graph** — `User` ←→ `Follow`, a self-referencing many-to-many with state

```
   followerId ──┐                        ┌── followingId
                ▼                        ▼
            ┌───────────────────────────────┐
            │  Follow                       │
            │  status: PENDING | ACCEPTED   │
            │  @@id([followerId, followingId])
            └───────────────────────────────┘
```

**Content graph**

```
   User ──1:N──▶ Post ──1:N──▶ Comment
    │             ▲
    └──1:N──▶ Like┘     Like: @@id([userId, postId])
```

`Notification` references both: a recipient, an actor, and an optional post.

### Tables

| Table          | Primary key                 | Notes                                           |
| -------------- | --------------------------- | ----------------------------------------------- |
| `User`         | `id`                        | `username` and `email` unique, stored lowercase |
| `Post`         | `id`                        | text and/or image, cascade from author          |
| `Comment`      | `id`                        | flat, not threaded                              |
| `Like`         | `(userId, postId)`          | no surrogate id                                 |
| `Follow`       | `(followerId, followingId)` | `CHECK` prevents self-follow                    |
| `Notification` | `id`                        | nullable `postId` — follow events have no post  |

### Decisions

**Composite primary keys on `Like` and `Follow`.** The pair _is_ the identity —
there is no such thing as two of the same like. Enforcing it in the schema
rather than with an `if` in a service makes it immune to races between
concurrent requests or API instances: the second write fails on the constraint
instead of reading stale state and inserting a duplicate.

**Integer primary keys, not UUIDv4.** Sequential integers append to the right
edge of the B-tree and preserve index locality; random UUIDs scatter writes and
cost 16 bytes in every foreign key and index. Integers are enumerable, so every
public route addresses users by `username` and the id never leaves the database.
A sharded or multi-writer deployment would move to a time-sortable id
(UUIDv7 / ULID / Snowflake), not to UUIDv4.

**`status` on `Follow` instead of a separate request table.** A pending request
and an accepted follow are one relationship in two states. Accepting is an
`UPDATE` of a single row, which cannot half-fail. It is written as `updateMany`
with `status: 'PENDING'` in the filter, so accepting twice returns a clean 404
rather than silently succeeding.

**`passwordHash` is nullable.** Guest accounts have no password, and neither
would OAuth accounts. A dummy value would create rows that falsely appear to
hold a credential. Past a handful of providers this becomes a separate
`AuthProvider` table.

**Usernames stored lowercase, with a separate `displayName`.** Postgres `UNIQUE`
is case-sensitive, so `Jashan` and `jashan` would be two accounts — an
impersonation vector.

**Self-follow is blocked by a `CHECK` constraint** added by hand-editing the
generated migration, since Prisma's schema language cannot express one, plus a
guard in the service layer so users get a clean 400 rather than a database
exception.

**Counters are computed, not stored.** Like and comment counts come from
`COUNT(*)` and Prisma's `_count`. Denormalising them is a measured optimisation,
not a default — see _Scaling notes_.

## API

Base path `/api/v1`. Every route except `/auth/*` and `/health` requires
`Authorization: Bearer <token>`.

### Conventions

- Single resource `{ "post": {...} }`; collection
  `{ "posts": [...], "nextCursor": "..." | null }`; error
  `{ "error": { "message": "...", "details": [...], "requestId": "..." } }`.
- `401` unauthenticated, `403` authenticated but forbidden, `404` also used to
  conceal the existence of resources the viewer may not see.
- `PUT`/`DELETE` for idempotent state-setting; `POST` only for creation and for
  state transitions triggered by a third party.
- Users are addressed by `username`, posts and comments by integer id.

### Endpoints

| Method                 | Path                                          | Notes                                      |
| ---------------------- | --------------------------------------------- | ------------------------------------------ |
| `POST`                 | `/auth/register`                              | `201 { user, token }`                      |
| `POST`                 | `/auth/login`                                 | one error message for every failure mode   |
| `POST`                 | `/auth/guest`                                 | creates a real user with no password       |
| `GET`                  | `/auth/me`                                    |                                            |
| `GET`                  | `/users?q=&cursor=`                           | searchable directory                       |
| `GET`                  | `/users/:username`                            | profile, counts, viewer relationship       |
| `PATCH`                | `/users/me`                                   | displayName, bio, isPrivate                |
| `PUT` `DELETE`         | `/users/me/avatar`                            | multipart upload / remove                  |
| `GET`                  | `/users/:username/posts`                      |                                            |
| `GET`                  | `/users/:username/followers` `/following`     |                                            |
| `PUT` `DELETE`         | `/users/:username/follow`                     | follow-or-request / unfollow-or-cancel     |
| `GET`                  | `/follow-requests`                            | incoming, pending                          |
| `POST`                 | `/follow-requests/:username/accept` `/reject` |                                            |
| `POST`                 | `/posts`                                      | JSON, or multipart with an image           |
| `GET` `PATCH` `DELETE` | `/posts/:id`                                  | write paths are owner-only                 |
| `GET`                  | `/feed?cursor=`                               | self + accepted follows                    |
| `PUT` `DELETE`         | `/posts/:id/like`                             | idempotent, returns `{ liked, likeCount }` |
| `GET`                  | `/posts/:id/likes`                            |                                            |
| `POST` `GET`           | `/posts/:id/comments`                         | oldest first                               |
| `DELETE`               | `/comments/:id`                               | comment author **or** post author          |
| `GET`                  | `/notifications`                              | + `unreadCount`                            |
| `POST`                 | `/notifications/read`                         |                                            |
| `GET`                  | `/health`                                     | readiness — pings the database             |

### Pagination

Keyset (cursor) pagination on every collection, never `OFFSET`.

Offset pagination is O(offset) — the database generates and discards every
skipped row — and it is incorrect under concurrent writes, because an insert
shifts every row down and the next page repeats one the client has already seen.
On a feed, inserts happen at exactly the end being paginated, so this is the
normal case rather than an edge case.

Keyset names a row instead of a position:

```sql
WHERE ("createdAt", "id") < ($1, $2)
ORDER BY "createdAt" DESC, "id" DESC
LIMIT $3
```

The sort key is the pair `(createdAt, id)` because timestamps are not unique;
adding the id makes the ordering total, so the page boundary is unambiguous.
Prisma cannot express row-value comparison, so it is expanded to
`older OR (same instant AND lower id)`. Queries fetch `limit + 1` rows to detect
a next page without a `COUNT`. Cursors are base64url-encoded and opaque, so the
sort key can change without breaking clients.

The trade-off is that there is no "jump to page N" — correct for infinite
scroll, wrong for a numbered admin table.

### Visibility

Post privacy is one composable Prisma filter, not an `if` repeated per query:

```js
{
  OR: [
    { author: { isPrivate: false } },
    { authorId: viewerId },
    {
      author: {
        followers: { some: { followerId: viewerId, status: "ACCEPTED" } },
      },
    },
  ];
}
```

It composes into the single-post, profile-timeline and interaction queries via
`AND`. A post the viewer may not see simply does not match, so `findFirst`
returns `null` and the caller returns `404` — concealment falls out of the
filter rather than needing a separate permission check.

Reads conceal (`404`); writes refuse (`403`). Editing or deleting someone
else's post returns `403`, because you are allowed to know it exists.

### Avoiding N+1

Per-viewer state is resolved one query per page, not one per row. A page of 20
posts issues exactly two queries: the page itself (with counts via `_count`),
then a single `SELECT ... WHERE userId = ? AND postId IN (...)` whose result is
turned into a `Set`. The same pattern resolves follow status on user lists.

## Authentication

A 7-day JWT carrying only the user id, verified by `passport-jwt` and exchanged
for a fresh database read on every request — so a changed or deleted account
takes effect immediately rather than when the token expires.

Registration relies on the unique constraint rather than a pre-check: it
attempts the insert and translates Prisma's `P2002` into a `409`. A
read-then-write check has a gap in which two simultaneous signups can both pass.

Login returns an identical `401` whether the email is unknown or the password is
wrong, so the endpoint cannot be used to enumerate registered addresses.

Planned hardening: a 15-minute access token plus a rotating refresh token stored
hashed in the database and delivered as an httpOnly cookie. The stored row is
what makes revocation possible — a bare JWT cannot be logged out before it
expires — and rotation makes token theft detectable, because replaying an
already-used refresh token invalidates the whole family.

## Real-time

Socket.io shares the HTTP server, so there is one port and one CORS
configuration. Authentication runs in `io.use` before the `connection` event, so
an unauthenticated socket never reaches a handler; it verifies the same JWT and
reloads the user, exactly as the REST middleware does.

Each connection joins a room named `user:<id>`, derived from the _verified_
token. Clients cannot name their own room — a `socket.on("subscribe", room =>
socket.join(room))` handler would let anyone receive another user's
notifications.

Notifications are deduplicated: creating one deletes any existing notification
with the same `(recipient, actor, type, post)` inside a transaction, so toggling
a like cannot stack up rows. Undoing the cause withdraws the notification.
Creation is best-effort and swallows its own errors — a side effect must never
be able to fail the action that produced it.

The client keeps a 60-second poll as a fallback, because WebSocket upgrades are
blocked by some proxies and a badge that silently stops updating is worse than
one that is a minute late.

## Operations

- **Configuration is validated at import.** One module reads `process.env`; a
  missing variable throws before the server can listen, so a misconfigured
  process never starts and never passes a health check.
- **Structured JSON logging** (pino) with a per-request id, reused from an
  inbound `X-Request-Id` when a proxy sets one. Credentials are redacted inside
  the logger, so a careless `log.info({ req })` cannot leak a token. The request
  id is returned in error responses, so a user can quote it and the exact log
  line is one search away.
- **One error exit.** Expected errors (`AppError` subclasses) log at `warn` and
  return their own message; anything else logs a full stack at `error` and
  returns a generic message, so SQL fragments, file paths and connection strings
  never reach a client.
- **`/health` pings the database** and returns `503` when it is unreachable, so
  a load balancer takes the instance out of rotation instead of sending it
  traffic it cannot serve.
- **Graceful shutdown.** `SIGTERM` closes Socket.io first — WebSockets never end
  on their own and would block `server.close()` indefinitely — then drains
  in-flight HTTP requests and closes the connection pool, with a 10-second cap.
- **Images** are streamed to Cloudinary from memory and never touch the server's
  disk, resized on upload, and stored with their `public_id` so replacing an
  avatar deletes the old file. Cleanup is best-effort: an orphaned file is
  cheaper than a failed request.
- **Migrations** run as `prisma migrate deploy` in the build step — never
  `migrate dev`, which is interactive and may offer to reset the database.
  Postgres is accessed through a pooled connection at runtime and a direct one
  for migrations.

## Deliberate simplifications

1. Pull-based feed (fan-out on read), not precomputed timelines.
2. `COUNT(*)` for like and comment counts.
3. No indexes beyond primary and unique keys.
4. Hard deletes, no audit trail.
5. Flat comments, not threaded.
6. No caching layer.
7. Access tokens only; refresh tokens designed but not built.

Each is revisited below.

## Scaling notes

Measured, not assumed. Test dataset: 500 users, 20,000 posts, 99,567 likes,
40,000 comments, ~15,000 follow edges, on local PostgreSQL 18. The test user
follows 172 accounts, so roughly 34% of all posts qualify for their feed.

### Result

| Measurement                   | Before   | After        |
| ----------------------------- | -------- | ------------ |
| `GET /feed?limit=20` (median) | 17.6 ms  | **3.1 ms**   |
| Database time per request     | 29 ms    | **4 ms**     |
| Feed query                    | 30.65 ms | **0.243 ms** |
| Buffers touched               | 1,620    | 271          |
| Rows examined                 | ~160,000 | ~300         |

Two changes produced that, and the second was a surprise.

### 1. Index design

The feed sorts globally by time and filters by a set of authors. With no index
beyond the primary key, Postgres read all 20,000 posts, kept 6,800, and sorted
them to find 21:

```
Seq Scan on "Post"  (actual rows=6800)  Rows Removed by Filter: 13200
Sort  Sort Method: top-N heapsort  Memory: 34kB
Execution Time: 1.743 ms
```

Adding `@@index([createdAt DESC, id DESC])` let it walk the index already in
sorted order, apply the author filter as it went, and stop once it had 21:

```
Index Scan using "Post_createdAt_id_idx"  (actual rows=65)
  Rows Removed by Filter: 44
Execution Time: 0.065 ms
```

65 rows instead of 20,000, no sort at all — 27× faster.

The arithmetic predicts that exactly: 34% of posts match, so 21 matches should
appear within 21 ÷ 0.34 ≈ 62 rows. Observed: 65.

That also shows the index's limit. It wins because matches are _dense_. A user
following three accounts out of 500 would have to walk thousands of index
entries to collect 21 rows, and the sequential scan would become competitive
again. Which plan is right depends on the follow ratio, and Postgres decides
from the statistics `ANALYZE` collects — not from the index existing.

A second index, `@@index([authorId, createdAt DESC])`, serves the profile
timeline, which filters by one author and sorts by time. Column order follows
the **leftmost-prefix rule**: an index on `(A, B)` serves filters on `A`, or on
`A` and `B`, but never on `B` alone. The feed's global ordering cannot use it.

The same rule explains `@@index([postId])` on `Like`. That table's primary key
is `(userId, postId)` — a perfectly good index that was **useless** for
counting a post's likes, because `postId` is not leading. It read all 99,567
rows to find 5. With the index: an `Index Only Scan` over 3 buffers, answered
entirely from the index without touching the table.

### 2. The ORM's `_count` was the real bottleneck

Prisma's `_count` in a `select` does not compile to a correlated subquery per
row. It builds a full aggregate over the entire related table and left-joins
the result:

```sql
LEFT JOIN (SELECT "postId", COUNT(*) FROM "Like" WHERE 1=1
           GROUP BY "postId") AS aggr_selection_0_Like ...
LEFT JOIN (SELECT "postId", COUNT(*) FROM "Comment" WHERE 1=1
           GROUP BY "postId") AS aggr_selection_1_Comment ...
```

Note `WHERE 1=1` — there is no filter, so the index on `Like.postId` cannot
help. Every feed request hashed 99,567 likes and 40,000 comments into two
20,000-row tables in order to annotate 21 posts: **25 ms of the 30.65 ms, 81%
of the query.**

It cost a second thing that was not obvious until the plan was read. The hash
joins destroy the index's ordering, so the `LIMIT` can no longer push down into
the scan — the plan reverted to `Seq Scan` + `Sort` and the 27× index win was
silently cancelled. An ORM convenience both added 25 ms and disabled the
optimisation added to remove it.

Replacing it with `Post.likeCount` and `Post.commentCount` columns took the
feed query to **0.243 ms** and restored the index scan.

### The cost of denormalising

Counters are not free, and the trade is explicit:

- **Writes do more.** Liking is now two statements in one transaction — insert
  the `Like`, then `UPDATE "Post" SET "likeCount" = "likeCount" + 1`. Reads
  outnumber writes here by a wide margin, so this is the right direction.
- **Correctness depends on discipline.** The increment uses Prisma's atomic
  `increment`, which compiles to `SET x = x + 1` in SQL rather than a
  read-modify-write in application code, so concurrent likes both land. It runs
  inside the same transaction as the insert, so a crash cannot apply one
  without the other. And it only fires when a row was genuinely inserted —
  `createMany` with `skipDuplicates` reports a count, which `upsert` cannot, so
  a double click does not inflate the number.
- **Drift is assumed, not hoped against.** A `CHECK ("likeCount" >= 0)`
  constraint turns silent corruption into a loud failure, and
  `npm run reconcile` recomputes both counters from the rows they count. The
  repair job is part of the design.

### What breaks next

Current state: ~3 ms per feed request, almost all of it application and HTTP
overhead rather than Postgres. The next limits, in the order they would arrive:

**Counter contention.** A post that goes viral serialises every like behind a
row lock on its single `Post` row. The fix is to shard the counter across N
rows and sum them, or to accept eventual consistency and batch increments
through a queue. Not a problem at hundreds of likes per post; a real one at
thousands per second.

**Feed fan-out.** The feed is computed on read: every request walks the follow
graph. That is correct and cheap while the follow set is small and matches are
dense. It degrades in two ways — a user following 10,000 accounts, and the
index's dense-match assumption failing for users following very few. The
standard answer is fan-out **on write**: when a post is created, push its id
into a precomputed timeline list for each follower. Reads become a single range
read; writes become O(followers). That inverts the cost, which is why it breaks
for accounts with millions of followers — the "celebrity problem" — and why
real systems run a hybrid: push for ordinary accounts, pull for the few with
huge followings, merged at read time.

**Caching.** Nothing is cached. The obvious first target is the first page of
each active user's feed in Redis, since most sessions never scroll past it.
Invalidation is the hard part and is itself a fan-out problem: a new post must
invalidate every follower's cached page. A short TTL (30–60 s) avoids that
entirely at the cost of slightly stale feeds, which is usually an acceptable
trade for a social timeline.

**Connection limits.** One `PrismaClient` per process owns a pool, and Postgres
defaults to ~100 connections. Thirty containers at 10 connections each
exhausts that. Production already routes through a pooler (PgBouncer in
transaction mode, via Neon), which is why migrations use a separate direct
connection — transaction-mode pooling cannot carry the session state they need.

**Read replicas.** Feed reads vastly outnumber writes, so they could go to a
replica with writes staying on the primary. The catch is replication lag: a
user who posts and is immediately redirected to their feed may not see their
own post. That needs read-your-own-writes handling — route a user's reads to
the primary for a few seconds after they write.

**Unbounded growth.** `Notification` grows forever and is almost never read
beyond the newest page. It wants a retention policy. `Post` would eventually
want range partitioning on `createdAt`, since feeds read recent rows and
archives are cold.

### Deliberately still unfixed

- No caching layer.
- Feed is pull-based.
- `Follow` has no index on `followerId` alone; the composite primary key covers
  it, and that was confirmed in the query plan rather than assumed.
- Access tokens only — refresh tokens are designed above but not built.
- No rate limiting on write endpoints.
