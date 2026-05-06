const express = require("express");
const controller = require("./user.controller");
const { authenticate, authorize, requireUserSelfOrAdmin } = require("../auth/auth.middleware");

const router = express.Router();

router.post("/owners", authenticate, authorize("admin"), controller.createOwner);
router.patch("/owners/me", authenticate, authorize("owner"), controller.updateMyOwnerProfile);
router.patch("/drivers/me", authenticate, authorize("driver"), controller.updateMyDriverProfile);
router.post("/attendants", authenticate, authorize("owner"), controller.createAttendant);
router.get("/attendants/mine", authenticate, authorize("owner"), controller.listMyAttendants);
router.patch("/attendants/:attendantId", authenticate, authorize("owner"), controller.updateAttendant);
router.delete("/attendants/:attendantId", authenticate, authorize("owner"), controller.deleteAttendant);
router.get("/:id", authenticate, requireUserSelfOrAdmin, controller.getUserById);

module.exports = router;
