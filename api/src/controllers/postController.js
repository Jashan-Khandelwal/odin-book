const postService = require("../services/postService");
const { parseLimit, decodeCursor } = require("../lib/pagination");

async function create(req, res) {
  const post = await postService.createPost({
    viewerId: req.user.id,
    content: req.body.content,
  });
  res.status(201).json({ post });
}

async function getOne(req, res) {
  const post = await postService.getPost({
    viewerId: req.user.id,
    postId: Number(req.params.postId),
  });
  res.json({ post });
}

async function update(req, res) {
  const post = await postService.updatePost({
    viewerId: req.user.id,
    postId: Number(req.params.postId),
    content: req.body.content,
  });
  res.json({ post });
}

async function remove(req, res) {
  await postService.deletePost({
    viewerId: req.user.id,
    postId: Number(req.params.postId),
  });
  res.status(204).end();
}

async function listByUser(req, res) {
  const result = await postService.listUserPosts({
    viewerId: req.user.id,
    username: req.params.username,
    cursor: decodeCursor(req.query.cursor),
    limit: parseLimit(req.query.limit),
  });
  res.json(result);
}

module.exports = { create, getOne, update, remove, listByUser };
