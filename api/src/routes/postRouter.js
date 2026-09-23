const { Router } = require("express");
const { body, param } = require("express-validator");

const postController = require("../controllers/postController");
const { requireAuth } = require("../middleware/auth");
const { handleValidation } = require("../middleware/validate");
const likeController = require("../controllers/likeController");
const commentController = require("../controllers/commentController");
const { singleImage } = require("../lib/upload");

const router = Router();

router.use(requireAuth);

const commentContentRule = body("content")
  .trim()
  .notEmpty()
  .withMessage("A comment cannot be empty.")
  .isLength({ max: 300 })
  .withMessage("A comment must be 300 characters or fewer.");

const postIdParam = param("postId")
  .isInt({ min: 1 })
  .withMessage("Invalid post id.");

const contentRule = body("content")
  .trim()
  .isLength({ max: 500 })
  .withMessage("A post must be 500 characters or fewer.")
  // A post needs SOMETHING. req.file exists only if multer just parsed one.
  .custom((value, { req }) => {
    if (!value && !req.file) {
      throw new Error("A post needs text, an image, or both.");
    }
    return true;
  });

// router.post("/", contentRule, handleValidation, postController.create);
router.post("/", singleImage("image"), contentRule, handleValidation, postController.create);

router.get("/:postId", postIdParam, handleValidation, postController.getOne);

router.patch(
  "/:postId",
  [postIdParam, contentRule],
  handleValidation,
  postController.update,
);

router.delete("/:postId", postIdParam, handleValidation, postController.remove);

router.put("/:postId/like", postIdParam, handleValidation, likeController.like);
router.delete("/:postId/like", postIdParam, handleValidation, likeController.unlike);
router.get("/:postId/likes", postIdParam, handleValidation, likeController.listLikers);

router.post("/:postId/comments", [postIdParam, commentContentRule], handleValidation, commentController.create);
router.get("/:postId/comments", postIdParam, handleValidation, commentController.list);

module.exports = router;
