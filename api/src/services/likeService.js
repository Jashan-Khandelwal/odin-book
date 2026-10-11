const prisma = require("../db/prisma");
const { userPublicSelect } = require("../db/selects");
const { cursorWhere, cursorOrderBy, buildPage } = require("../lib/pagination");
const { assertPostVisible } = require("./visibility");
const { attachViewerStatus } = require("./relationship");
const { notify, withdraw } = require("./notificationService");

// No more COUNT(*). The counter is the source of truth for reads; the Like
// rows are the source of truth for correctness, and reconcile-counts.js
// repairs the counter from them if they ever disagree.

async function like({ viewerId, postId }) {
  const post = await assertPostVisible(postId, viewerId);

  // The insert and the increment must be one unit, or a crash between them
  // leaves the counter wrong forever.
  const likeCount = await prisma.$transaction(async (tx) => {
    // createMany + skipDuplicates reports whether a row was actually
    // inserted. upsert cannot tell us that, and the counter must only move
    // on a NEW like — otherwise a double click inflates it.
    const { count } = await tx.like.createMany({
      data: [{ userId: viewerId, postId }],
      skipDuplicates: true,
    });

    if (count === 0) {
      const existing = await tx.post.findUnique({
        where: { id: postId },
        select: { likeCount: true },
      });
      return existing.likeCount;
    }

    // `increment` compiles to SET "likeCount" = "likeCount" + 1 in SQL — an
    // atomic update, not a read-modify-write in JavaScript. Two concurrent
    // likes both land correctly.
    const updated = await tx.post.update({
      where: { id: postId },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true },
    });
    return updated.likeCount;
  });

  await notify({
    recipientId: post.authorId,
    actorId: viewerId,
    type: "LIKE",
    postId,
  });

  return { liked: true, likeCount };
}

async function unlike({ viewerId, postId }) {
  const post = await assertPostVisible(postId, viewerId);

  const likeCount = await prisma.$transaction(async (tx) => {
    const { count } = await tx.like.deleteMany({
      where: { userId: viewerId, postId },
    });

    if (count === 0) {
      const existing = await tx.post.findUnique({
        where: { id: postId },
        select: { likeCount: true },
      });
      return existing.likeCount;
    }

    const updated = await tx.post.update({
      where: { id: postId },
      data: { likeCount: { decrement: 1 } },
      select: { likeCount: true },
    });
    return updated.likeCount;
  });

  await withdraw({
    recipientId: post.authorId,
    actorId: viewerId,
    type: "LIKE",
    postId,
  });

  return { liked: false, likeCount };
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
