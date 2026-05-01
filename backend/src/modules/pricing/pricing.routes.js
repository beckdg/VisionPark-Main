const express = require("express");
const { authenticate, authorize } = require("../auth/auth.middleware");
const controller = require("./pricing.controller");

const router = express.Router();

router.get(
  "/vehicle-categories",
  authenticate,
  authorize("owner", "admin"),
  controller.getVehicleCategories
);

router.get("/config", authenticate, authorize("owner", "admin"), controller.getConfig);

router.put("/config", authenticate, authorize("owner", "admin"), controller.putConfig);

module.exports = router;
