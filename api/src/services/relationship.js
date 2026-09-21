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
    viewer: { followStatus: statusByUserId.get(u.id) ?? null },
  }));
}

// For a page of posts, ONE extra query tells us which ones the viewer has
// liked. Also flattens Prisma's _count into plain likeCount/commentCount,
// so the API shape doesn't leak the ORM's naming.
async function attachPostViewerState(posts, viewerId) {
  if (posts.length === 0) return posts;

  const liked = await prisma.like.findMany({
    where: { userId: viewerId, postId: { in: posts.map((p) => p.id) } },
    select: { postId: true },
  });
  const likedIds = new Set(liked.map((l) => l.postId));

  return posts.map(({ _count, ...post }) => ({
    ...post,
    likeCount: _count.likes,
    commentCount: _count.comments,
    viewer: {
      hasLiked: likedIds.has(post.id),
      isAuthor: post.author.id === viewerId,
    },
  }));
}

module.exports = { attachViewerStatus, attachPostViewerState };
