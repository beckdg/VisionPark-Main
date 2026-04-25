const express = require("express");
const controller = require("./user.controller");
const { authenticate, authorize, requireUserSelfOrAdmin } = require("../auth/auth.middleware");

const router = express.Router();

router.post("/owners", authenticate, authorize("admin"), controller.createOwner);
router.post("/attendants", authenticate, authorize("owner"), controller.createAttendant);
router.get("/:id", authenticate, requireUserSelfOrAdmin, controller.getUserById);

module.exports = router;
