const pino = require("pino");
const config = require("../config");

// One logger per process. `pino-http` derives a child logger per request
// from this one, which is how request ids get attached automatically.
const logger = pino({
  level: config.logLevel,

  // Credentials must never reach a log file or a log aggregator.
  // Redaction happens inside pino, so a careless `log.info({ req })`
  // still cannot leak a token.
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "*.password",
      "passwordHash",
      "*.passwordHash",
      "token",
      "*.token",
    ],
    censor: "[redacted]",
  },

  // Development: pipe through pino-pretty for readable lines.
  // Production: emit raw newline-delimited JSON for the platform to collect.
  transport: config.isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l",
          ignore: "pid,hostname",
        },
      },
});

module.exports = logger;
