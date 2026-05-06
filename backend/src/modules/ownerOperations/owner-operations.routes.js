const express = require("express");
const controller = require("./owner-operations.controller");
const { authenticate, authorize } = require("../auth/auth.middleware");

const router = express.Router();

router.get("/operations/incidents", authenticate, authorize("owner"), controller.getOwnerIncidents);
router.patch(
  "/operations/incidents/:incidentId/status",
  authenticate,
  authorize("owner"),
  controller.updateOwnerIncidentStatus
);

module.exports = router;

