const express = require("express");
const controller = require("./attendant-incidents.controller");
const { authenticate, authorize } = require("../auth/auth.middleware");

const router = express.Router();

router.get("/incidents/recent", authenticate, authorize("attendant"), controller.listRecentIncidents);
router.post("/incidents", authenticate, authorize("attendant"), controller.createIncident);

module.exports = router;

