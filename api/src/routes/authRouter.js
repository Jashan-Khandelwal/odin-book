const { Router } = require("express");
const { body } = require("express-validator");

const authController = require("../controllers/authController");
const { handleValidation } = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");

const router = Router();

const registerRules = [
  body("username")
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage("Username must be between 3 and 20 characters.")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username may only contain letters, numbers and underscores."),
  body("displayName")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Display name must be 50 characters or fewer."),
  body("email").trim().isEmail().withMessage("A valid email is required."),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters."),
];

const loginRules = [
  body("email").trim().isEmail().withMessage("A valid email is required."),
  body("password").notEmpty().withMessage("Password is required."),
];

router.post("/register", registerRules, handleValidation, authController.register);
router.post("/login", loginRules, handleValidation, authController.login);
router.post("/guest", authController.guest);
router.get("/me", requireAuth, authController.me);

module.exports = router;
