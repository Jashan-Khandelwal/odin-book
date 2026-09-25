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

_To be written against measured numbers: seed ~20k posts, read the feed query
plan, add indexes, and record the before/after._
