const prisma = require("../db/prisma");
const { userPublicSelect, userPrivateSelect } = require("../db/selects");
const { NotFoundError } = require("../lib/errors");
const {
  cursorWhere,
  cursorOrderBy,
  buildPage,
} = require("../lib/pagination");

// For a page of users, work out the viewer's relationship to each of them
// in ONE extra query rather than one query per user.
async function attachViewerStatus(users, viewerId) {
  if (users.length === 0) return users;

  const follows = await prisma.follow.findMany({
    where: {
      followerId: viewerId,
      followingId: { in: users.map((u) => u.id) },
    },
    select: { followingId: true, status: true },
  });

  const statusByUserId = new Map(follows.map((f) => [f.followingId, f.status]));

  return users.map((u) => ({
    ...u,
    // null | "PENDING" | "ACCEPTED" — the frontend picks the button from this.
    viewer: { followStatus: statusByUserId.get(u.id) ?? null },
  }));
}

async function listUsers({ viewerId, q, cursor, limit }) {
  const filters = [
    { id: { not: viewerId } }, // you are not in your own directory
    cursorWhere(cursor),
  ];

  if (q) {
    filters.push({
      OR: [
        { username: { contains: q, mode: "insensitive" } },
        { displayName: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const rows = await prisma.user.findMany({
    where: { AND: filters },
    select: userPublicSelect,
    orderBy: cursorOrderBy(),
    take: limit + 1,
  });

  const { page, nextCursor } = buildPage(rows, limit, (u) => ({
    createdAt: u.createdAt,
    id: u.id,
  }));

  return { users: await attachViewerStatus(page, viewerId), nextCursor };
}

async function getProfile({ username, viewer }) {
  const handle = username.toLowerCase();
  const isSelf = viewer.username === handle;

  const user = await prisma.user.findUnique({
    where: { username: handle },
    // Your own profile includes your email; someone else's does not.
    select: isSelf ? userPrivateSelect : userPublicSelect,
  });

  if (!user) throw new NotFoundError("User not found.");

  const [postCount, followerCount, followingCount, outgoing, incoming] =
    await Promise.all([
      prisma.post.count({ where: { authorId: user.id } }),
      prisma.follow.count({
        where: { followingId: user.id, status: "ACCEPTED" },
      }),
      prisma.follow.count({
        where: { followerId: user.id, status: "ACCEPTED" },
      }),
      // My relationship to them.
      prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: viewer.id,
            followingId: user.id,
          },
        },
        select: { status: true },
      }),
      // Their relationship to me.
      prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: user.id,
            followingId: viewer.id,
          },
        },
        select: { status: true },
      }),
    ]);

  return {
    ...user,
    postCount,
    followerCount,
    followingCount,
    viewer: {
      isSelf,
      followStatus: outgoing?.status ?? null,
      followsYou: incoming?.status === "ACCEPTED",
      // Phase 5 uses this to decide whether to serve their posts.
      canSeePosts:
        isSelf || !user.isPrivate || outgoing?.status === "ACCEPTED",
    },
  };
}

async function updateMe({ viewerId, displayName, bio, isPrivate }) {
  const data = {};
  // `undefined` means "not sent" — a PATCH only changes what it names.
  if (displayName !== undefined) data.displayName = displayName.trim();
  if (bio !== undefined) data.bio = bio?.trim() || null;
  if (isPrivate !== undefined) data.isPrivate = isPrivate;

  // Going public accepts everyone who was waiting on you. Both statements
  // run as one unit, so you can never end up public with orphaned requests.
  if (isPrivate === false) {
    const [user] = await prisma.$transaction([
      prisma.user.update({
        where: { id: viewerId },
        data,
        select: userPrivateSelect,
      }),
      prisma.follow.updateMany({
        where: { followingId: viewerId, status: "PENDING" },
        data: { status: "ACCEPTED" },
      }),
    ]);
    return user;
  }

  return prisma.user.update({
    where: { id: viewerId },
    data,
    select: userPrivateSelect,
  });
}

module.exports = { listUsers, getProfile, updateMe };
