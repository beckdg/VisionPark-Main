const express = require("express");
const controller = require("./incident.controller");
const { authenticate, authorize } = require("../../auth/auth.middleware");

const router = express.Router();

router.use(authenticate);
router.use(authorize("attendant", "admin"));

router.post("/", controller.createIncident);
router.patch("/:incidentId/status", controller.transitionIncidentStatus);
router.get("/:incidentId", controller.getIncidentById);

module.exports = router;
