const express = require("express");
const controller = require("./enforcement.controller");
const { authenticate, authorize } = require("../../auth/auth.middleware");

const router = express.Router();

router.use(authenticate);
router.use(authorize("attendant", "admin"));

router.post("/", controller.createEnforcement);
router.post("/:enforcementId/clear", controller.clearEnforcementPost);
router.patch("/:enforcementId/transition", controller.transitionEnforcement);
router.post("/:enforcementId/block-spot", controller.applySpotBlock);
router.post("/:enforcementId/unblock-spot", controller.removeSpotBlock);
router.get("/:enforcementId", controller.getEnforcementById);

module.exports = router;
