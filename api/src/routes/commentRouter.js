const { Router } = require("express");
const { param } = require("express-validator");

const commentController = require("../controllers/commentController");
const { requireAuth } = require("../middleware/auth");
const { handleValidation } = require("../middleware/validate");

const router = Router();
router.use(requireAuth);

router.delete(
  "/:commentId",
  param("commentId").isInt({ min: 1 }).withMessage("Invalid comment id."),
  handleValidation,
  commentController.remove,
);

module.exports = router;
