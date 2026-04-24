const express = require("express");
const controller = require("./transaction.controller");
const {
  authenticate,
  authorize,
  requireBodyDriverIdMatchesAuthUser,
  requireTransactionAccess,
} = require("../../auth/auth.middleware");

const router = express.Router();

router.post(
  "/",
  authenticate,
  authorize("driver", "admin"),
  requireBodyDriverIdMatchesAuthUser,
  controller.createPendingTransaction
);
router.patch(
  "/:transactionId/complete",
  authenticate,
  authorize("driver", "admin"),
  requireTransactionAccess,
  controller.completeTransaction
);
router.get(
  "/:transactionId",
  authenticate,
  authorize("driver", "admin"),
  requireTransactionAccess,
  controller.getTransactionById
);

module.exports = router;
