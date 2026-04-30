const express = require("express");
const controller = require("./parking.controller");
const {
  authenticate,
  authorize,
  requireLotMutationScope,
  requireZoneSpotLotOwnedByUser,
} = require("../auth/auth.middleware");

const router = express.Router();

router.get("/public/lots", controller.listPublicLots);

router.get(
  "/lots",
  authenticate,
  authorize("owner", "admin", "driver", "attendant"),
  controller.listLots
);
router.get("/zones", authenticate, authorize("owner", "admin", "driver"), controller.listZones);
router.get("/spots", authenticate, authorize("owner", "admin", "driver"), controller.listSpots);
router.post(
  "/lots",
  authenticate,
  authorize("owner", "admin"),
  requireLotMutationScope,
  controller.createLot
);
router.patch(
  "/lots/:lotId",
  authenticate,
  authorize("owner", "admin"),
  controller.updateLot
);
router.delete(
  "/lots/:lotId",
  authenticate,
  authorize("owner", "admin"),
  controller.deleteLot
);
router.post(
  "/zones",
  authenticate,
  authorize("owner", "admin"),
  requireZoneSpotLotOwnedByUser,
  controller.createZone
);
router.patch(
  "/zones/:zoneId",
  authenticate,
  authorize("owner", "admin"),
  controller.updateZone
);
router.delete(
  "/zones/:zoneId",
  authenticate,
  authorize("owner", "admin"),
  controller.deleteZone
);
router.post(
  "/spots",
  authenticate,
  authorize("owner", "admin"),
  requireZoneSpotLotOwnedByUser,
  controller.createSpot
);
router.patch(
  "/spots/:spotId",
  authenticate,
  authorize("owner", "admin"),
  controller.updateSpot
);
router.delete(
  "/spots/:spotId",
  authenticate,
  authorize("owner", "admin"),
  controller.deleteSpot
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
