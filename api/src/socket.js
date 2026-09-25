const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const config = require("./config");
const logger = require("./lib/logger");
const prisma = require("./db/prisma");
const { setIo, roomForUser } = require("./lib/realtime");

function attachSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.corsOrigins, credentials: true },
  });

  // Same JWT as the REST API, but presented in the handshake rather than an
  // Authorization header — a browser can't set custom headers on a
  // WebSocket upgrade, so socket.io carries it in `auth` instead.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication required."));

      const payload = jwt.verify(token, config.jwtSecret);

      const user = await prisma.user.findUnique({
        where: { id: Number(payload.sub) },
        select: { id: true, username: true },
      });
      if (!user) return next(new Error("Authentication required."));

      // socket.data is per-connection storage, like req.user for HTTP.
      socket.data.user = user;
      next();
    } catch {
      next(new Error("Authentication required."));
    }
  });

  io.on("connection", (socket) => {
    const { id, username } = socket.data.user;

    // One room per user. Joining is the only thing a client may do — we
    // never let the client choose its own room, or it could subscribe to
    // someone else's notifications.
    socket.join(roomForUser(id));

    logger.debug(
      { userId: id, username, socketId: socket.id },
      "socket connected",
    );

    socket.on("disconnect", (reason) => {
      logger.debug(
        { userId: id, socketId: socket.id, reason },
        "socket disconnected",
      );
    });
  });

  setIo(io);
  return io;
}

module.exports = { attachSocketServer };
