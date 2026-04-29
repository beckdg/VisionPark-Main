const express = require("express");
const controller = require("./finance.controller");
const { authenticate, authorize } = require("../auth/auth.middleware");

const router = express.Router();

// Owner-scoped transaction ledger for the Financial Reports page.
router.get("/transactions", authenticate, authorize("owner"), controller.getOwnerTransactions);

// Owner-scoped revenue aggregation for the revenue trend chart.
router.get("/reports/revenue", authenticate, authorize("owner"), controller.getOwnerRevenueTrend);

module.exports = router;

