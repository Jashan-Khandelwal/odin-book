const { faker } = require("@faker-js/faker");
const bcrypt = require("bcryptjs");
const prisma = require("../src/db/prisma");

const USERS = 500;
const POSTS_PER_USER = 40; // ~20,000 posts
const FOLLOWS_PER_USER = 30; // ~15,000 follow rows
const LIKES_PER_POST = 5; // ~100,000 likes
const COMMENTS_PER_POST = 2; // ~40,000 comments
const JASHAN_FOLLOWS = 150;

const DAY = 86_400_000;

// Postgres caps a statement at 65535 bound parameters, so one giant
// createMany would fail. Insert in chunks instead.
async function insertChunked(model, rows, size = 5000) {
  for (let i = 0; i < rows.length; i += size) {
    await model.createMany({
      data: rows.slice(i, i + size),
      skipDuplicates: true,
    });
  }
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function main() {
  console.time("total");

  await prisma.notification.deleteMany();
  await prisma.like.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);

  // Pre-generate a pool of text and reuse it. Calling faker 20,000 times
  // costs more than the database work we are trying to measure.
  const PARAS = Array.from({ length: 500 }, () => faker.lorem.paragraph());
  const LINES = Array.from({ length: 300 }, () => faker.lorem.sentence());

  // --- users ---
  const userRows = [
    {
      username: "jashan",
      displayName: "Jashan",
      email: "jashan@odinbook.test",
      passwordHash,
      bio: "Building Odin-Book.",
    },
  ];
  for (let i = 1; i < USERS; i++) {
    userRows.push({
      username: `user${i}`,
      displayName: faker.person.fullName(),
      email: `user${i}@odinbook.test`,
      passwordHash,
      bio: pick(LINES),
      isPrivate: i % 10 === 0,
    });
  }
  await insertChunked(prisma.user, userRows);

  const users = await prisma.user.findMany({
    select: { id: true, isPrivate: true },
  });
  const jashan = await prisma.user.findUnique({
    where: { username: "jashan" },
    select: { id: true },
  });
  console.log("users:", users.length);

  // --- follows ---
  const follows = [];
  for (const follower of users) {
    const seen = new Set();
    for (let i = 0; i < FOLLOWS_PER_USER; i++) {
      const target = pick(users);
      if (target.id === follower.id || seen.has(target.id)) continue;
      seen.add(target.id);
      follows.push({
        followerId: follower.id,
        followingId: target.id,
        status: target.isPrivate ? "PENDING" : "ACCEPTED",
      });
    }
  }
  // Give jashan a big following list, so the feed query has real work to do.
  for (const target of users
    .filter((u) => u.id !== jashan.id)
    .slice(0, JASHAN_FOLLOWS)) {
    follows.push({
      followerId: jashan.id,
      followingId: target.id,
      status: "ACCEPTED",
    });
  }
  await insertChunked(prisma.follow, follows);
  console.log("follows:", follows.length);

  // --- posts ---
  const now = Date.now();
  const posts = [];
  for (const user of users) {
    for (let i = 0; i < POSTS_PER_USER; i++) {
      posts.push({
        content: pick(PARAS),
        authorId: user.id,
        // Spread over 180 days so ordering and pagination are meaningful.
        createdAt: new Date(now - Math.random() * 180 * DAY),
      });
    }
  }
  await insertChunked(prisma.post, posts);

  const postRows = await prisma.post.findMany({
    select: { id: true, createdAt: true },
  });
  console.log("posts:", postRows.length);

  // --- likes ---
  const likes = [];
  for (const post of postRows) {
    const seen = new Set();
    for (let i = 0; i < LIKES_PER_POST; i++) {
      const u = pick(users);
      if (seen.has(u.id)) continue;
      seen.add(u.id);
      likes.push({ userId: u.id, postId: post.id });
    }
  }
  await insertChunked(prisma.like, likes);
  console.log("likes:", likes.length);

  // --- comments ---
  const comments = [];
  for (const post of postRows) {
    for (let i = 0; i < COMMENTS_PER_POST; i++) {
      comments.push({
        content: pick(LINES),
        postId: post.id,
        authorId: pick(users).id,
        createdAt: new Date(post.createdAt.getTime() + Math.random() * 3 * DAY),
      });
    }
  }
  await insertChunked(prisma.comment, comments);
  console.log("comments:", comments.length);

  console.timeEnd("total");
  console.log("sign in as jashan@odinbook.test / password123");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
