const userService = require("../services/userService");
const { parseLimit, decodeCursor } = require("../lib/pagination");

async function list(req, res) {
  const result = await userService.listUsers({
    viewerId: req.user.id,
    q: req.query.q?.trim() || null,
    cursor: decodeCursor(req.query.cursor),
    limit: parseLimit(req.query.limit),
  });
  res.json(result);
}

async function getProfile(req, res) {
  const user = await userService.getProfile({
    username: req.params.username,
    viewer: req.user,
  });
  res.json({ user });
}

async function updateMe(req, res) {
  // Read the fields explicitly rather than forwarding req.body, so a
  // client can't set a column we never meant to expose.
  const { displayName, bio, isPrivate } = req.body;
  const user = await userService.updateMe({
    viewerId: req.user.id,
    displayName,
    bio,
    isPrivate,
  });
  res.json({ user });
}

async function updateAvatar(req, res) {
  const user = await userService.updateAvatar({
    viewerId: req.user.id,
    buffer: req.file.buffer,
  });
  res.json({ user });
}

async function removeAvatar(req, res) {
  const user = await userService.removeAvatar({ viewerId: req.user.id });
  res.json({ user });
}

module.exports = { list, getProfile, updateMe, updateAvatar, removeAvatar };
