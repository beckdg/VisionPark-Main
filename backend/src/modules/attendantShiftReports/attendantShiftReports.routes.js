const express = require("express");
const controller = require("./attendantShiftReports.controller");
const { authenticate, authorize } = require("../auth/auth.middleware");

const router = express.Router();

router.post("/start", authenticate, authorize("attendant"), controller.startShift);
router.get(
  "/current-z-report",
  authenticate,
  authorize("attendant"),
  controller.getCurrentZReport
);
router.post("/close", authenticate, authorize("attendant"), controller.closeShift);

module.exports = router;
