const { Router } = require("express");
const notificationController = require("../controllers/notificationController");
const { requireAuth } = require("../middleware/auth");

const router = Router();
router.use(requireAuth);

router.get("/", notificationController.list);
router.post("/read", notificationController.markAllRead);

module.exports = router;
