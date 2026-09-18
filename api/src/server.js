const createApp = require("./app");
const config = require("./config");
const logger = require("./lib/logger");
const prisma = require("./db/prisma");

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.env }, "odinbook api listening");
});

// Graceful shutdown. On deploy the platform sends SIGTERM and then SIGKILLs
// after a grace period. Without this, in-flight requests are severed
// mid-transaction and users see connection resets on every deploy.
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return; // a second Ctrl-C should not re-enter
  shuttingDown = true;
  logger.info({ signal }, "shutting down");

  // Stop accepting NEW connections; let in-flight ones finish.
  server.close(async () => {
    await prisma.$disconnect();
    logger.info("shutdown complete");
    process.exit(0);
  });

  // If a request hangs, don't wait forever. .unref() so this timer alone
  // never keeps the process alive.
  setTimeout(() => {
    logger.error("forced shutdown after 10s timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// If either of these fires, our error plumbing has a hole. The process is
// in an unknown state, so log loudly and die rather than serve traffic.
process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "unhandled rejection — exiting");
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaught exception — exiting");
  process.exit(1);
});
