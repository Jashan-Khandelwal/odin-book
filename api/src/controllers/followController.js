const followService = require("../services/followService");
const { parseLimit, decodeCursor } = require("../lib/pagination");

async function follow(req, res) {
  const result = await followService.follow({
    viewerId: req.user.id,
    username: req.params.username,
  });
  res.json(result);
}

async function unfollow(req, res) {
  await followService.unfollow({
    viewerId: req.user.id,
    username: req.params.username,
  });
  res.status(204).end();
}

function listGraph(direction) {
  return async (req, res) => {
    const result = await followService.listGraph({
      viewerId: req.user.id,
      username: req.params.username,
      direction,
      cursor: decodeCursor(req.query.cursor),
      limit: parseLimit(req.query.limit),
    });
    res.json(result);
  };
}

async function listRequests(req, res) {
  const result = await followService.listRequests({
    viewerId: req.user.id,
    cursor: decodeCursor(req.query.cursor),
    limit: parseLimit(req.query.limit),
  });
  res.json(result);
}

async function accept(req, res) {
  const result = await followService.acceptRequest({
    viewerId: req.user.id,
    username: req.params.username,
  });
  res.json(result);
}

async function reject(req, res) {
  await followService.rejectRequest({
    viewerId: req.user.id,
    username: req.params.username,
  });
  res.status(204).end();
}

module.exports = {
  follow,
  unfollow,
  listFollowers: listGraph("followers"),
  listFollowing: listGraph("following"),
  listRequests,
  accept,
  reject,
};
