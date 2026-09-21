const { Router } = require("express");
const { body, param } = require("express-validator");

const postController = require("../controllers/postController");
const { requireAuth } = require("../middleware/auth");
const { handleValidation } = require("../middleware/validate");

const router = Router();
router.use(requireAuth);

const postIdParam = param("postId")
  .isInt({ min: 1 })
  .withMessage("Invalid post id.");

const contentRule = body("content")
  .trim()
  .notEmpty()
  .withMessage("A post cannot be empty.")
  .isLength({ max: 500 })
  .withMessage("A post must be 500 characters or fewer.");

router.post("/", contentRule, handleValidation, postController.create);

router.get("/:postId", postIdParam, handleValidation, postController.getOne);

router.patch(
  "/:postId",
  [postIdParam, contentRule],
  handleValidation,
  postController.update,
);

router.delete("/:postId", postIdParam, handleValidation, postController.remove);

module.exports = router;
