const express = require("express");
const controller = require("./attendant-ai-exceptions.controller");
const { authenticate, authorize } = require("../auth/auth.middleware");

const router = express.Router();

router.get("/ai-exceptions", authenticate, authorize("attendant"), controller.listAIExceptions);
router.get("/ai-exceptions/stats", authenticate, authorize("attendant"), controller.getAIExceptionStats);
router.get("/ai-exceptions/:exceptionId", authenticate, authorize("attendant"), controller.getAIExceptionById);
router.post(
  "/ai-exceptions/:exceptionId/resolve",
  authenticate,
  authorize("attendant"),
  controller.resolveAIException
);

module.exports = router;

