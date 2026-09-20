const { Router } = require("express");
const { body, param } = require("express-validator");

const userController = require("../controllers/userController");
const { requireAuth } = require("../middleware/auth");
const { handleValidation } = require("../middleware/validate");

const router = Router();

// Nothing about users is visible to anonymous callers.
router.use(requireAuth);

router.get("/", userController.list);

// MUST be declared before "/:username", or "me" is read as a username.
router.patch(
  "/me",
  [
    body("displayName")
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage("Display name must be between 1 and 50 characters."),
    body("bio")
      .optional({ values: "null" })
      .trim()
      .isLength({ max: 200 })
      .withMessage("Bio must be 200 characters or fewer."),
    body("isPrivate")
      .optional()
      .isBoolean()
      .withMessage("isPrivate must be true or false.")
      .toBoolean(),
  ],
  handleValidation,
  userController.updateMe,
);

router.get(
  "/:username",
  param("username")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Invalid username."),
  handleValidation,
  userController.getProfile,
);

module.exports = router;
