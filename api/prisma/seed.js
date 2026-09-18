const { faker } = require("@faker-js/faker");
const bcrypt = require("bcryptjs");
const prisma = require("../src/db/prisma");

const USER_COUNT = 12;
const PASSWORD = "password123";

async function main() {
  // Start from empty every time, so seeding is repeatable.
  // Order matters: children before parents.
  await prisma.notification.deleteMany();
  await prisma.like.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.user.deleteMany();

  // One hash reused for every seeded user — hashing 12 times would be slow
  // and they all share the same password anyway.
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const users = [];

  // A known account, so you always have something to log in with.
  users.push(
    await prisma.user.create({
      data: {
        username: "jashan",
        displayName: "Jashan",
        email: "jashan@odinbook.test",
        passwordHash,
        bio: "Building Odin-Book.",
      },
    }),
  );

  for (let i = 0; i < USER_COUNT - 1; i++) {
    const first = faker.person.firstName();
    const last = faker.person.lastName();
    // Strip anything that isn't a safe username character, then add a
    // numeric suffix so two identical fake names can't collide.
    const handle =
      `${first}${last}`.toLowerCase().replace(/[^a-z0-9]/g, "") + i;

    users.push(
      await prisma.user.create({
        data: {
          username: handle,
          displayName: `${first} ${last}`,
          email: `${handle}@odinbook.test`,
          passwordHash,
          bio: faker.lorem.sentence(),
          // Every fifth account is private, so there is always something
          // to test follow requests against.
          isPrivate: i % 5 === 0,
        },
      }),
    );
  }

  // Each user follows a random handful of others. Following a private
  // account creates a PENDING row; a public one is ACCEPTED immediately.
  const follows = [];
  for (const follower of users) {
    const targets = faker.helpers.arrayElements(
      users.filter((u) => u.id !== follower.id),
      { min: 2, max: 6 },
    );
    for (const target of targets) {
      follows.push({
        followerId: follower.id,
        followingId: target.id,
        status: target.isPrivate ? "PENDING" : "ACCEPTED",
      });
    }
  }
  await prisma.follow.createMany({ data: follows, skipDuplicates: true });

  // Posts get an explicit createdAt spread over the last 30 days. Without
  // that they would all share one timestamp and the feed would have no
  // meaningful order to paginate through.
  const posts = [];
  for (const user of users) {
    const count = faker.number.int({ min: 2, max: 6 });
    for (let i = 0; i < count; i++) {
      posts.push(
        await prisma.post.create({
          data: {
            content: faker.lorem.paragraph(),
            authorId: user.id,
            createdAt: faker.date.recent({ days: 30 }),
          },
        }),
      );
    }
  }

  const likes = [];
  for (const post of posts) {
    for (const liker of faker.helpers.arrayElements(users, {
      min: 0,
      max: 7,
    })) {
      likes.push({ userId: liker.id, postId: post.id });
    }
  }
  await prisma.like.createMany({ data: likes, skipDuplicates: true });

  const comments = [];
  for (const post of posts) {
    const count = faker.number.int({ min: 0, max: 4 });
    for (let i = 0; i < count; i++) {
      comments.push({
        postId: post.id,
        authorId: faker.helpers.arrayElement(users).id,
        content: faker.lorem.sentence(),
        // A comment can't predate its post.
        createdAt: faker.date.between({ from: post.createdAt, to: new Date() }),
      });
    }
  }
  await prisma.comment.createMany({ data: comments });

  console.log(
    `seeded ${users.length} users, ${follows.length} follows, ` +
      `${posts.length} posts, ${likes.length} likes, ${comments.length} comments`,
  );
  console.log(`log in as jashan@odinbook.test / ${PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
