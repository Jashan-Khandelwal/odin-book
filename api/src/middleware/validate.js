const { validationResult } = require("express-validator");
const { BadRequestError } = require("../lib/errors");

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  next(
    new BadRequestError(
      "Validation failed.",
      errors.array().map((e) => ({ field: e.path, message: e.msg })),
    ),
  );
}

module.exports = { handleValidation };

// So after all six rules run, req is carrying a hidden list that looks roughly like:

// js
// [
//   { path: "username", msg: "Username may only contain letters..." },
//   { path: "email",    msg: "A valid email is required." },
// ]

// Nothing has been rejected. The request is still moving toward the controller.

// What handleValidation does

// It's the one that reads that list and makes the decision.