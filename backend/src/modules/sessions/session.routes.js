const express = require("express");
const controller = require("./session.controller");
const {
  authenticate,
  authorize,
  requireBodyDriverIdMatchesAuthUser,
  requireSecureSessionAccess,
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
  requireSecureSessionAccess,
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
  "/me",
  authenticate,
  authorize("driver"),
  controller.getMySessions
);
router.get(
  "/my",
  authenticate,
  authorize("driver"),
  controller.getMySessions
);
router.get(
  "/:sessionId/exit-eligibility",
  authenticate,
  requireSessionReadAccess,
  controller.getExitEligibility
);
router.post(
  "/:sessionId/exit-validate",
  authenticate,
  requireSessionReadAccess,
  controller.validatePhysicalExit
);
router.post(
  "/:sessionId/exit-override",
  authenticate,
  authorize("attendant", "admin"),
  controller.postExitOverride
);
router.get(
  "/:sessionId",
  authenticate,
  requireSessionReadAccess,
  controller.getSessionById
);

module.exports = router;
