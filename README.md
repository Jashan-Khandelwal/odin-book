# Odin-Book

A Threads/X-style social network: text and image posts, an asymmetric follow
graph with follow requests, likes, comments, a personalised feed, and real-time
notifications.

**[Live demo](https://odin-book-rose.vercel.app)** — use **Continue as guest**
to look around without signing up.

> The API is on a free tier that sleeps when idle, so the first request after a
> quiet period can take up to a minute. Everything after that is immediate.

## Features

- Email/password auth with JWT, plus one-click guest access
- Public and private accounts — private accounts approve followers
- Follow requests: send, cancel, accept, reject
- Posts with text, images, or both
- Likes and comments, with per-post moderation by the post's author
- A feed of posts from you and the people you follow
- Profiles with avatar, bio, follower/following lists
- Searchable user directory
- Real-time notifications over WebSockets

## Stack

| Layer | Choice |
| --- | --- |
| API | Node, Express 5, Prisma, PostgreSQL |
| Auth | Passport (JWT strategy), bcrypt |
| Real-time | Socket.io |
| Images | Cloudinary |
| Client | React 19, React Router 7, Tailwind CSS 4, Vite |
| Hosting | Neon (database), Render (API), Vercel (client) |

## Design

The architecture, data model, API contract and the reasoning behind each
decision are written up in **[DESIGN.md](./DESIGN.md)**. Some highlights:

- **Keyset pagination everywhere, never `OFFSET`.** Offset pagination is
  O(offset) and returns duplicate rows when items are inserted while a user is
  paging — which on a feed is the normal case, not an edge case.
- **Composite primary keys on `Like` and `Follow`.** "One like per user per
  post" is enforced by the database, not by an `if` in a service, so concurrent
  requests can't both pass a check and then both insert.
- **A layered API**: route → middleware → controller → service → Prisma.
  Business rules live in services and are testable without HTTP.
- **One visibility filter.** Post privacy is a composable Prisma filter used by
  the single-post, profile and feed queries, so the rule has exactly one
  definition.
- **Idempotent mutations.** Liking and following use `PUT`/`DELETE` and are safe
  to repeat — a double click or a retried request is a no-op.

## Running locally

Requires Node 20+ and PostgreSQL.

```bash
git clone https://github.com/Jashan-Khandelwal/odin-book.git
cd odin-book
createdb odinbook
```

**API**

```bash
cd api
npm install
cp .env.example .env     # then fill in DATABASE_URL, DIRECT_URL, JWT_SECRET
npx prisma migrate dev
npm run seed
npm run dev              # http://localhost:3002
```

`CLOUDINARY_URL` is optional — without it everything works except image
uploads, which return a clear 503.

**Client**

```bash
cd client
npm install
cp .env.example .env     # VITE_API_URL=http://localhost:3002/api/v1
npm run dev              # http://localhost:5175
```

Seeded accounts use the password `password123`; sign in as
`jashan@odinbook.test`.

## Project layout

```
api/
  prisma/        schema, migrations, seed
  src/
    config/      the only module that reads process.env
    db/          Prisma client and shared select shapes
    lib/         errors, logger, pagination, uploads, realtime
    middleware/  auth, validation, error handling
    routes/      URL and verb wiring
    controllers/ HTTP in, HTTP out
    services/    business rules
client/
  src/
    components/  Avatar, PostCard, Composer, Comments, FollowButton, ...
    context/     auth and notification providers
    lib/         API client, pagination hook, socket
    pages/       Feed, Profile, Users, Requests, Notifications, ...
```

Built as the final project of The Odin Project's Node.js path.
