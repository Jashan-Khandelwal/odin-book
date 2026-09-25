let io = null;

// server.js hands the instance over once the socket server exists.
function setIo(instance) {
  io = instance;
}

const roomForUser = (userId) => `user:${userId}`;

// Emit to every socket that user has open. A no-op when there is no socket
// server — which is the case in tests, and in scripts like the seeder that
// import services directly.
function emitToUser(userId, event, payload) {
  if (!io) return;
  io.to(roomForUser(userId)).emit(event, payload);
}

async function closeIo() {
  if (io) await io.close();
  io = null;
}

module.exports = { setIo, emitToUser, roomForUser, closeIo };
