const express = require("express");
const controller = require("./chapa.controller");
const { authenticate, authorize } = require("../../auth/auth.middleware");

const router = express.Router();

router.post(
  "/initialize",
  authenticate,
  authorize("driver"),
  controller.initializeParkingPayment
);

router.get("/callback", controller.chapaCallback);

router.post("/webhook", controller.chapaWebhook);

router.get(
  "/verify/:tx_ref",
  authenticate,
  authorize("driver"),
  controller.verifyByTxRef
);

router.get(
  "/debug/:tx_ref",
  authenticate,
  authorize("admin"),
  controller.debugByTxRef
);

module.exports = router;
