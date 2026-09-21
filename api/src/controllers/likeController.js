const likeService = require("../services/likeService");
const { parseLimit, decodeCursor } = require("../lib/pagination");

async function like(req, res) {
  const result = await likeService.like({
    viewerId: req.user.id,
    postId: Number(req.params.postId),
  });
  res.json(result);
}

async function unlike(req, res) {
  const result = await likeService.unlike({
    viewerId: req.user.id,
    postId: Number(req.params.postId),
  });
  res.json(result);
}

async function listLikers(req, res) {
  const result = await likeService.listLikers({
    viewerId: req.user.id,
    postId: Number(req.params.postId),
    cursor: decodeCursor(req.query.cursor),
    limit: parseLimit(req.query.limit),
  });
  res.json(result);
}

module.exports = { like, unlike, listLikers };
