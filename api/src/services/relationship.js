const { FollowStatus } = require("@prisma/client");
const prisma = require("../db/prisma");

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
    viewer: { FollowStatus: statusByUserId.get(u.id) ?? null },
  }));
}
module.exports = { attachViewerStatus };
