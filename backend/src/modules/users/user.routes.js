const express = require("express");
const controller = require("./user.controller");
const { authenticate, authorize, requireUserSelfOrAdmin } = require("../auth/auth.middleware");

const router = express.Router();

router.post("/", authenticate, authorize("admin"), controller.createUser);
router.get("/:id", authenticate, requireUserSelfOrAdmin, controller.getUserById);

module.exports = router;
