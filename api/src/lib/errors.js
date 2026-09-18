// Errors the application raises deliberately, as opposed to bugs.
// Services throw these. Controllers do not catch them. The error-handling
// middleware is the single place that turns one into an HTTP response.

class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends AppError {
  constructor(message = "Bad request.", details) {
    super(400, message, details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = "Authentication required.") {
    super(401, message);
  }
}

class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to do that.") {
    super(403, message);
  }
}

class NotFoundError extends AppError {
  constructor(message = "Not found.") {
    super(404, message);
  }
}

class ConflictError extends AppError {
  constructor(message = "That already exists.") {
    super(409, message);
  }
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
};
