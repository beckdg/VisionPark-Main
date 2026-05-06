const express = require("express");
const controller = require("./attendantWalkup.controller");
const { authenticate, authorize } = require("../auth/auth.middleware");

const router = express.Router();

router.post("/walkup/checkin", authenticate, authorize("attendant"), controller.createWalkupCheckin);
router.get("/walkup/recent", authenticate, authorize("attendant"), controller.getRecentWalkupCheckins);
router.get("/walkup/receipts/:checkinId", authenticate, authorize("attendant"), controller.getWalkupReceipt);

module.exports = router;

