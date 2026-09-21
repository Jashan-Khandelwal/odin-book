const commentService = require("../services/commentService");
const { parseLimit, decodeCursor } = require("../lib/pagination");

async function create(req, res) {
  const comment = await commentService.createComment({
    viewerId: req.user.id,
    postId: Number(req.params.postId),
    content: req.body.content,
  });
  res.status(201).json({ comment });
}

async function list(req, res) {
  const result = await commentService.listComments({
    viewerId: req.user.id,
    postId: Number(req.params.postId),
    cursor: decodeCursor(req.query.cursor),
    limit: parseLimit(req.query.limit),
  });
  res.json(result);
}

async function remove(req, res) {
  await commentService.deleteComment({
    viewerId: req.user.id,
    commentId: Number(req.params.commentId),
  });
  res.status(204).end();
}

module.exports = { create, list, remove };
