const express = require("express");
const controller = require("./attendantLiveGrid.controller");
const { authenticate, authorize } = require("../auth/auth.middleware");

const router = express.Router();

// Attendant scoped live occupancy grid.
router.get("/live-grid", authenticate, authorize("attendant"), controller.getLiveGrid);

// Marks a spot as waitingToMove = true until the spot becomes free again.
router.post(
  "/spots/:spotId/instruct-leave",
  authenticate,
  authorize("attendant"),
  controller.instructLeave
);

module.exports = router;

