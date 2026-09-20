const { Router } = require("express");
const prisma = require("../db/prisma");

const router = Router();

router.use("/auth", require("./authRouter"));
// GET /api/v1/health
// This is a READINESS check, not just a liveness check: the process can be
// running fine while Postgres is unreachable, and a load balancer needs to
// take this instance out of rotation when that happens.
router.use("/users", require("./userRouter"));

router.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    req.log.error({ err }, "health check: database unreachable");
    return res
      .status(503)
      .json({ status: "degraded", database: "unreachable" });
  }

  res.json({ status: "ok", uptime: process.uptime() });
});

module.exports = router;
