const { PrismaClient } = require("@prisma/client");
const config = require("../config");
const logger = require("../lib/logger");

// ONE client for the entire process. Each PrismaClient owns a connection
// pool, so constructing one per request would exhaust Postgres's
// max_connections almost immediately.
const prisma = new PrismaClient({
  log: config.isProduction
    ? [{ emit: "event", level: "error" }]
    : [
        { emit: "event", level: "query" },
        { emit: "event", level: "warn" },
        { emit: "event", level: "error" },
      ],
});

prisma.$on("error", (e) => logger.error({ prisma: e }, "prisma error"));

if (!config.isProduction) {
  prisma.$on("warn", (e) => logger.warn({ prisma: e }, "prisma warning"));

  // Every query, with its duration. This is how you catch an N+1 problem:
  // one request that prints forty near-identical lines.
  prisma.$on("query", (e) =>
    logger.debug(
      { query: e.query, params: e.params, durationMs: e.duration },
      "prisma query",
    ),
  );
}

module.exports = prisma;
