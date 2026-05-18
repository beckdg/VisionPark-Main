const express = require("express");
const controller = require("./ownerAttendants.controller");
const { authenticate, authorize } = require("../auth/auth.middleware");

const router = express.Router();

router.get("/attendants/branches", authenticate, authorize("owner"), controller.listBranches);
router.get("/attendants", authenticate, authorize("owner"), controller.listAttendants);
router.get(
  "/attendants/:attendantId",
  authenticate,
  authorize("owner"),
  controller.getAttendantDetails
);
router.get(
  "/shift-reports/:reportId",
  authenticate,
  authorize("owner"),
  controller.getShiftReport
);

module.exports = router;
