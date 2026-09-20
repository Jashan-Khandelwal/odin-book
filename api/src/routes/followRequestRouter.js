const { Router } = require("express");
const { param } = require("express-validator");

const followController = require("../controllers/followController");
const { requireAuth } = require("../middleware/auth");
const { handleValidation } = require("../middleware/validate");

const router = Router();
router.use(requireAuth);

const usernameParam = param("username")
  .matches(/^[a-zA-Z0-9_]+$/)
  .withMessage("Invalid username.");

router.get("/", followController.listRequests);
router.post(
  "/:username/accept",
  usernameParam,
  handleValidation,
  followController.accept,
);
router.post(
  "/:username/reject",
  usernameParam,
  handleValidation,
  followController.reject,
);

module.exports = router;
