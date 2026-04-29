const express = require("express");
const controller = require("./analytics.controller");
const { authenticate, authorize } = require("../auth/auth.middleware");

const router = express.Router();

router.get(
  "/owner/dashboard",
  authenticate,
  authorize("owner"),
  controller.getOwnerDashboard
);

router.get(
  "/owner/occupancy",
  authenticate,
  authorize("owner"),
  controller.getOwnerOccupancy
);

router.get(
  "/owner/revenue",
  authenticate,
  authorize("owner"),
  controller.getOwnerRevenue
);

router.get(
  "/owner/recent-activity",
  authenticate,
  authorize("owner"),
  controller.getOwnerRecentActivity
);

module.exports = router;

