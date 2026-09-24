const prisma = require("../db/prisma");
const { userPublicSelect } = require("../db/selects");
const { cursorWhere, cursorOrderBy, buildPage } = require("../lib/pagination");
const { assertPostVisible } = require("./visibility");
const { attachViewerStatus } = require("./relationship");
const { notify, withdraw } = require("./notificationService");

// Recounted on every change. Deliberately naive — Phase 12 replaces this
// with a stored counter once there's enough data to measure the difference.
function countLikes(postId) {
  return prisma.like.count({ where: { postId } });
}

// PUT /posts/:postId/like
async function like({ viewerId, postId }) {
  const post = await assertPostVisible(postId, viewerId);

  await prisma.like.upsert({
    where: { userId_postId: { userId: viewerId, postId } },
    create: { userId: viewerId, postId },
    update: {},
  });

  await notify({
    recipientId: post.authorId,
    actorId: viewerId,
    type: "LIKE",
    postId,
  });

  return { liked: true, likeCount: await countLikes(postId) };
}

// DELETE /posts/:postId/like
async function unlike({ viewerId, postId }) {
  const post = await assertPostVisible(postId, viewerId);

  await prisma.like.deleteMany({ where: { userId: viewerId, postId } });

  // Undoing the like undoes the notification too.
  await withdraw({
    recipientId: post.authorId,
    actorId: viewerId,
    type: "LIKE",
    postId,
  });

  return { liked: false, likeCount: await countLikes(postId) };
}

// GET /posts/:postId/likes
async function listLikers({ viewerId, postId, cursor, limit }) {
  await assertPostVisible(postId, viewerId);

  const rows = await prisma.like.findMany({
    where: { AND: [{ postId }, cursorWhere(cursor, "userId")] },
    select: { createdAt: true, user: { select: userPublicSelect } },
    orderBy: cursorOrderBy("userId"),
    take: limit + 1,
  });

  const { page, nextCursor } = buildPage(rows, limit, (r) => ({
    createdAt: r.createdAt,
    id: r.user.id,
  }));

  const users = await attachViewerStatus(
    page.map((r) => r.user),
    viewerId,
  );

  return { users, nextCursor };
}

module.exports = { like, unlike, listLikers };
