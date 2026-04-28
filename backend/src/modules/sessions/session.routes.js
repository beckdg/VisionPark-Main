const express = require("express");
const controller = require("./session.controller");
const {
  authenticate,
  authorize,
  requireBodyDriverIdMatchesAuthUser,
  requireCloseSessionAccess,
  requireSessionReadAccess,
} = require("../auth/auth.middleware");

const router = express.Router();

router.post(
  "/reservations",
  authenticate,
  authorize("driver", "admin"),
  requireBodyDriverIdMatchesAuthUser,
  controller.createReservation
);
router.post(
  "/:sessionId/secure",
  authenticate,
  authorize("attendant", "admin"),
  controller.secureSession
);
router.post(
  "/:sessionId/expire",
  authenticate,
  authorize("attendant", "admin"),
  controller.expireSession
);
router.post(
  "/:sessionId/close",
  authenticate,
  requireCloseSessionAccess,
  controller.closeSession
);
router.get(
  "/me/active",
  authenticate,
  authorize("driver", "admin"),
  controller.getMyActiveSession
);
router.get(
  "/:sessionId",
  authenticate,
  requireSessionReadAccess,
  controller.getSessionById
);

module.exports = router;
