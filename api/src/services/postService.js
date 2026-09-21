const prisma = require("../db/prisma");
const { postSelect } = require("../db/selects");
const { NotFoundError, ForbiddenError } = require("../lib/errors");
const { cursorWhere, cursorOrderBy, buildPage } = require("../lib/pagination");
const { attachPostViewerState } = require("./relationship");
const { visibleToViewer } = require("./visibility");
// // THE visibility rule, written once. A post can be seen when its author is
// // public, OR is the viewer, OR has accepted the viewer as a follower.
// // Because it is a Prisma filter rather than an if-statement, it composes
// // into any query — one post, one user's posts, or the whole feed.
// function visibleToViewer(viewerId) {
//   return {
//     OR: [
//       { author: { isPrivate: false } },
//       { authorId: viewerId },
//       {
//         author: {
//           followers: { some: { followerId: viewerId, status: "ACCEPTED" } },
//         },
//       },
//     ],
//   };
// }

// Every read returns the same shape, so they all finish the same way.
async function decorate(post, viewerId) {
  const [decorated] = await attachPostViewerState([post], viewerId);
  return decorated;
}

// Load a post for editing or deleting, and check ownership.
async function loadOwned(postId, viewerId, verb) {
  const existing = await prisma.post.findUnique({
    where: { id: postId },
    select: { authorId: true },
  });
  if (!existing) throw new NotFoundError("Post not found.");
  if (existing.authorId !== viewerId) {
    throw new ForbiddenError(`You can only ${verb} your own posts.`);
  }
}

async function createPost({ viewerId, content }) {
  const post = await prisma.post.create({
    data: { content: content.trim(), authorId: viewerId },
    select: postSelect,
  });
  return decorate(post, viewerId);
}

async function getPost({ viewerId, postId }) {
  const post = await prisma.post.findFirst({
    where: { AND: [{ id: postId }, visibleToViewer(viewerId)] },
    select: postSelect,
  });
  // 404, not 403 — we don't confirm that a post we won't show exists.
  if (!post) throw new NotFoundError("Post not found.");
  return decorate(post, viewerId);
}

async function updatePost({ viewerId, postId, content }) {
  await loadOwned(postId, viewerId, "edit");

  const post = await prisma.post.update({
    where: { id: postId },
    data: { content: content.trim() },
    select: postSelect,
  });
  return decorate(post, viewerId);
}

async function deletePost({ viewerId, postId }) {
  await loadOwned(postId, viewerId, "delete");
  await prisma.post.delete({ where: { id: postId } });
}

async function listUserPosts({ viewerId, username, cursor, limit }) {
  const author = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { id: true },
  });
  if (!author) throw new NotFoundError("User not found.");

  const rows = await prisma.post.findMany({
    where: {
      AND: [
        { authorId: author.id },
        visibleToViewer(viewerId),
        cursorWhere(cursor),
      ],
    },
    select: postSelect,
    orderBy: cursorOrderBy(),
    take: limit + 1,
  });

  const { page, nextCursor } = buildPage(rows, limit, (p) => ({
    createdAt: p.createdAt,
    id: p.id,
  }));

  return { posts: await attachPostViewerState(page, viewerId), nextCursor };
}

module.exports = {
  visibleToViewer,
  createPost,
  getPost,
  updatePost,
  deletePost,
  listUserPosts,
};
