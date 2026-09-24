const prisma = require("../db/prisma");
const logger = require("../lib/logger");
const { userPublicSelect } = require("../db/selects");
const { cursorWhere, cursorOrderBy, buildPage } = require("../lib/pagination");

const notificationSelect = {
  id: true,
  type: true,
  read: true,
  createdAt: true,
  actor: { select: userPublicSelect },
  post: { select: { id: true, content: true, imageUrl: true } },
};

// Best-effort. A notification failing must NEVER fail the action that
// caused it — nobody should lose a comment because a row didn't insert.
async function notify({ recipientId, actorId, type, postId = null }) {
  // Never tell someone about their own action.
  if (recipientId === actorId) return null;

  try {
    // At most one notification per (recipient, actor, type, post). Without
    // this, like → unlike → like would stack up three of them.
    const [, created] = await prisma.$transaction([
      prisma.notification.deleteMany({
        where: { recipientId, actorId, type, postId },
      }),
      prisma.notification.create({
        data: { recipientId, actorId, type, postId },
        select: notificationSelect,
      }),
    ]);
    return created;
  } catch (err) {
    logger.warn({ err, recipientId, actorId, type }, "notify failed");
    return null;
  }
}

// The inverse: withdraw a notification when its cause is undone —
// unliking, or cancelling a follow request.
async function withdraw({ recipientId, actorId, type, postId = null }) {
  if (recipientId === actorId) return;
  try {
    await prisma.notification.deleteMany({
      where: { recipientId, actorId, type, postId },
    });
  } catch (err) {
    logger.warn({ err, recipientId, actorId, type }, "withdraw failed");
  }
}

async function list({ viewerId, cursor, limit }) {
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { AND: [{ recipientId: viewerId }, cursorWhere(cursor)] },
      select: notificationSelect,
      orderBy: cursorOrderBy(),
      take: limit + 1,
    }),
    prisma.notification.count({
      where: { recipientId: viewerId, read: false },
    }),
  ]);

  const { page, nextCursor } = buildPage(rows, limit, (n) => ({
    createdAt: n.createdAt,
    id: n.id,
  }));

  return { notifications: page, nextCursor, unreadCount };
}

function unreadCount({ viewerId }) {
  return prisma.notification.count({
    where: { recipientId: viewerId, read: false },
  });
}

async function markAllRead({ viewerId }) {
  await prisma.notification.updateMany({
    where: { recipientId: viewerId, read: false },
    data: { read: true },
  });
}

module.exports = { notify, withdraw, list, unreadCount, markAllRead };
