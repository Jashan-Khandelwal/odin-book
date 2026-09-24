const notificationService = require("../services/notificationService");
const { parseLimit, decodeCursor } = require("../lib/pagination");

async function list(req, res) {
  const result = await notificationService.list({
    viewerId: req.user.id,
    cursor: decodeCursor(req.query.cursor),
    limit: parseLimit(req.query.limit),
  });
  res.json(result);
}

async function markAllRead(req, res) {
  await notificationService.markAllRead({ viewerId: req.user.id });
  res.status(204).end();
}

module.exports = { list, markAllRead };
