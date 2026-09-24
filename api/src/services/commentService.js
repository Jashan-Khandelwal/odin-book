const prisma = require("../db/prisma");
const { commentSelect } = require("../db/selects");
const { NotFoundError, ForbiddenError } = require("../lib/errors");
const { cursorWhere, cursorOrderBy, buildPage } = require("../lib/pagination");
const { assertPostVisible } = require("./visibility");
const { notify } = require("./notificationService");

// Strips the internal `post` field and works out permissions. No extra
// query — commentSelect already fetched the post's authorId.
function decorate(comment, viewerId) {
  const { post, ...rest } = comment;
  const isAuthor = comment.author.id === viewerId;
  return {
    ...rest,
    viewer: {
      isAuthor,
      // Two ways to be allowed: you wrote it, or it's on your post.
      canDelete: isAuthor || post.authorId === viewerId,
    },
  };
}

// POST /posts/:postId/comments
async function createComment({ viewerId, postId, content }) {
  const post = await assertPostVisible(postId, viewerId);

  const comment = await prisma.comment.create({
    data: { content: content.trim(), postId, authorId: viewerId },
    select: commentSelect,
  });

  await notify({
    recipientId: post.authorId,
    actorId: viewerId,
    type: "COMMENT",
    postId,
  });

  return decorate(comment, viewerId);
}

// GET /posts/:postId/comments — oldest first, the order you'd read them in.
async function listComments({ viewerId, postId, cursor, limit }) {
  await assertPostVisible(postId, viewerId);

  const rows = await prisma.comment.findMany({
    where: { AND: [{ postId }, cursorWhere(cursor, "id", "asc")] },
    select: commentSelect,
    orderBy: cursorOrderBy("id", "asc"),
    take: limit + 1,
  });

  const { page, nextCursor } = buildPage(rows, limit, (c) => ({
    createdAt: c.createdAt,
    id: c.id,
  }));

  return { comments: page.map((c) => decorate(c, viewerId)), nextCursor };
}

// DELETE /comments/:commentId
async function deleteComment({ viewerId, commentId }) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { authorId: true, post: { select: { authorId: true } } },
  });

  if (!comment) throw new NotFoundError("Comment not found.");

  const allowed =
    comment.authorId === viewerId || comment.post.authorId === viewerId;

  if (!allowed) {
    throw new ForbiddenError("You cannot delete that comment.");
  }

  await prisma.comment.delete({ where: { id: commentId } });
}

module.exports = { createComment, listComments, deleteComment };
