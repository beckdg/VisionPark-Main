const express = require("express");
const controller = require("./parking.controller");
const {
  authenticate,
  authorize,
  requireLotMutationScope,
  requireZoneSpotLotOwnedByUser,
} = require("../auth/auth.middleware");

const router = express.Router();

router.post(
  "/lots",
  authenticate,
  authorize("owner", "admin"),
  requireLotMutationScope,
  controller.createLot
);
router.post(
  "/zones",
  authenticate,
  authorize("owner", "admin"),
  requireZoneSpotLotOwnedByUser,
  controller.createZone
);
router.post(
  "/spots",
  authenticate,
  authorize("owner", "admin"),
  requireZoneSpotLotOwnedByUser,
  controller.createSpot
);
router.get("/spots/:spotId", authenticate, controller.getSpotById);
router.patch(
  "/spots/:spotId/block",
  authenticate,
  authorize("attendant", "admin"),
  controller.setSpotBlocked
);
router.post(
  "/spots/:spotId/derive-status",
  authenticate,
  authorize("attendant", "admin"),
  controller.deriveSpotStatus
);

module.exports = router;
