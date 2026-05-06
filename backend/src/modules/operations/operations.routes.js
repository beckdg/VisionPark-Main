const express = require("express");
const incidentRoutes = require("./incidents/incident.routes");
const enforcementRoutes = require("./enforcement/enforcement.routes");
const transactionRoutes = require("./transactions/transaction.routes");

const router = express.Router();

router.use("/incidents", incidentRoutes);
router.use("/enforcements", enforcementRoutes);
router.use("/transactions", transactionRoutes);

module.exports = router;
