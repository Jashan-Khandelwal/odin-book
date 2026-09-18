const { validationResult } = require("express-validator");
const { BadRequestError } = require("../lib/errors");

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  next(
    new BadRequestError(
      "validation failed,",
      errors.array().map((e) => ({ field: e.path, message: e.msg })),
    ),
  );
}

module.exports = { handleValidation };
