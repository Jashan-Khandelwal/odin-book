const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const pinoHttp = require("pino-http");
const { randomUUID } = require("node:crypto");

const passport = require("./config/passport");
const config = require("./config");
const logger = require("./lib/logger");
const { notFound, errorHandler } = require("./middleware/errorHandler");

// Builds the app and returns it — but never listens. server.js owns the
// port; tests import this and drive it in-process with supertest.
function createApp() {
  const app = express();

  // Behind a proxy (Railway, Render, Fly), the TCP peer is the load balancer,
  // not the user. This tells Express to read X-Forwarded-For instead, so
  // req.ip is the real client. Rate limiting in Phase 3 depends on it.
  app.set("trust proxy", 1);

  app.use(helmet());

  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true, // needed for the refresh-token cookie in Phase 12
    }),
  );

  // 16kb is generous for a text post and closes off a trivial
  // memory-exhaustion vector. Image uploads use multipart, not this parser.
  app.use(express.json({ limit: "16kb" }));

  app.use(
    pinoHttp({
      logger,

      // Reuse an id the proxy already set, so one id follows a request
      // across every service that touches it. Mint one otherwise.
      genReqId: (req) => req.headers["x-request-id"] || randomUUID(),

      customLogLevel: (req, res, err) => {
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },

      // The platform polls /health every few seconds. Logging it would
      // bury everything else.
      autoLogging: {
        ignore: (req) => req.url === "/api/v1/health",
      },
    }),
  );

  app.use(passport.initialize());

  app.use("/api/v1", require("./routes"));

  // Order matters: these must be last.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
