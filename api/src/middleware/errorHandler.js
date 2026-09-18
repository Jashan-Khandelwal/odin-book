const { AppError, NotFoundError } = require("../lib/errors");
const config = require("../config");

// Reached only when no route matched. Turning it into a thrown error means
// every failure leaves the app through ONE function, not two.
function notFound(req, res, next) {
  next(new NotFoundError(`No route for ${req.method} ${req.originalUrl}`));
}

// Express identifies an error handler by its FOUR arguments. `next` must
// stay in the signature even though it is never called.
function errorHandler(err, req, res, next) {
  // Did we throw this on purpose, or is it a bug?
  const isExpected = err instanceof AppError;
  const status = isExpected ? err.status : 500;

  if (isExpected) {
    // A business outcome ("post not found"). Not an incident.
    req.log.warn({ err, status }, "request failed");
  } else {
    // A bug. Full stack, error level, so it reaches alerting.
    req.log.error({ err }, "unhandled error");
  }

  const body = {
    error: {
      // An unexpected error's message can contain SQL, file paths, or a
      // connection string. Clients never see it.
      message: isExpected ? err.message : "Something went wrong.",
    },
  };

  if (isExpected && err.details) body.error.details = err.details;

  // Lets a user quote an id and you grep straight to the exact log line.
  if (req.id) body.error.requestId = req.id;

  // Stack traces to the client in development only — never in production.
  if (!isExpected && !config.isProduction) body.error.stack = err.stack;

  res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
