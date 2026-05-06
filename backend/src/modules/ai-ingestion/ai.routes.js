const express = require("express");
const { AIIngestionService } = require("./ai.service");
const { env } = require("../../config/env");
const { ValidationError } = require("../../common/errors");
const { requireAiApiKey } = require("../auth/auth.middleware");

const router = express.Router();
const service = new AIIngestionService();

router.post("/events", requireAiApiKey, async (req, res, next) => {
  try {
    const result = await service.ingestEvent(req.body);
    return res.status(202).json(result);
  } catch (error) {
    return next(error);
  }
});

router.post("/simulate", requireAiApiKey, async (req, res, next) => {
  try {
    if (!env.isDevelopment && !env.isTest) {
      throw new ValidationError("Simulation endpoint is enabled only in development/test.");
    }

    const type = req.body?.type;
    const base = {
      cameraId: req.body?.cameraId || "sim-camera-1",
      timestamp: new Date().toISOString(),
      confidence: typeof req.body?.confidence === "number" ? req.body.confidence : 0.92,
      metadata: {
        plate: req.body?.plate || "SIM-1234",
        category: req.body?.category || "car",
        sessionId: req.body?.sessionId || null,
        branchId: req.body?.branchId || "sim-branch-1",
        zoneId: req.body?.zoneId || "sim-zone-1",
      },
    };

    const mapping = {
      entry: { eventType: "entry_detected" },
      exit: { eventType: "exit_detected" },
      mismatch: { eventType: "mismatch_detected", metadata: { ...base.metadata, reason: "plate_mismatch" } },
      camera_offline: { eventType: "camera_status", metadata: { ...base.metadata, status: "offline" } },
    };

    if (!mapping[type]) {
      throw new ValidationError("Simulation type must be one of: entry, exit, mismatch, camera_offline.");
    }

    const payload = {
      ...base,
      ...mapping[type],
      metadata: {
        ...base.metadata,
        ...(mapping[type].metadata || {}),
      },
    };

    const result = await service.ingestEvent(payload);
    return res.status(202).json({ simulated: true, ...result });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
