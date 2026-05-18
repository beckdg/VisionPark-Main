const express = require("express");
const cors = require("cors");
const { requestContext } = require("./middleware/request-context");
const { errorHandler, notFoundHandler } = require("./middleware/error-handler");
const { logger } = require("../common/logger");
const mongoose = require("mongoose");
const { getRuntimeState } = require("./runtime-state");
const { env } = require("../config/env");

const { sessionRoutes } = require("../modules/sessions");
const { parkingRoutes } = require("../modules/parking");
const { operationsRoutes } = require("../modules/operations");
const { aiRoutes } = require("../modules/ai-ingestion");
const { userRoutes } = require("../modules/users");
const { authRoutes } = require("../modules/auth");
const { analyticsRoutes } = require("../modules/analytics");
const { financeRoutes } = require("../modules/finance");
const { attendantRoutes } = require("../modules/attendantLiveGrid");
const { attendantAIExceptionRoutes } = require("../modules/attendantAIExceptions");
const { attendantWalkupRoutes } = require("../modules/attendantWalkup");
const { attendantIncidentRoutes } = require("../modules/attendantIncidents");
const { attendantShiftReportsRoutes } = require("../modules/attendantShiftReports");
const { ownerOperationsRoutes } = require("../modules/ownerOperations");
const { ownerAttendantsRoutes } = require("../modules/ownerAttendants");
const { uploadRoutes } = require("../modules/uploads");
const { pricingRoutes } = require("../modules/pricing");
const { paymentRoutes } = require("../modules/payments");
const { ParkingSession } = require("../modules/sessions/models/parking-session.model");
const { ParkingSpot } = require("../modules/parking/models/parking-spot.model");
const { Incident } = require("../modules/operations/models/incident.model");
const { Enforcement } = require("../modules/operations/models/enforcement.model");

const createApp = () => {
  const app = express();
  app.disable("x-powered-by");

  const corsOptions = {
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (
        env.corsAllowedOrigins.includes("*") ||
        env.corsAllowedOrigins.includes(origin)
      ) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  };

  // Core middleware pipeline
  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(requestContext);
  app.use((req, _res, next) => {
    logger.debug("Incoming request", {
      module: "app.request",
      requestId: req.context?.requestId || null,
      userId: req.context?.userId || null,
      method: req.method,
      path: req.path,
    });
    next();
  });

  // Basic liveness endpoint for bootstrap validation.
  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "ok",
      requestId: req.context.requestId,
    });
  });

  app.get("/health/deep", async (req, res, next) => {
    try {
      const runtime = getRuntimeState();
      const mongoReadyState = mongoose.connection.readyState;
      const mongoConnected = mongoReadyState === 1;
      const healthy =
        mongoConnected &&
        runtime.jobs.initialized === true &&
        runtime.realtime.initialized === true;

      return res.status(healthy ? 200 : 503).json({
        status: healthy ? "ok" : "degraded",
        requestId: req.context.requestId,
        checks: {
          mongo: {
            connected: mongoConnected,
            readyState: mongoReadyState,
          },
          jobs: {
            initialized: runtime.jobs.initialized,
            lastHeartbeatAt: runtime.jobs.lastHeartbeatAt,
          },
          realtime: {
            initialized: runtime.realtime.initialized,
            connectedClients: runtime.realtime.connectedClients,
          },
          ai: {
            lastProcessedAt: runtime.ai.lastProcessedAt,
            lastCorrelationId: runtime.ai.lastCorrelationId,
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  app.get("/metrics", async (req, res, next) => {
    try {
      const [sessionAgg, spotAgg, incidentsCount, enforcementCount] = await Promise.all([
        ParkingSession.aggregate([{ $group: { _id: "$state", count: { $sum: 1 } } }]),
        ParkingSpot.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
        Incident.countDocuments({}),
        Enforcement.countDocuments({}),
      ]);

      const sessionsByState = sessionAgg.reduce((acc, row) => {
        acc[row._id] = row.count;
        return acc;
      }, {});

      const spotsByStatus = spotAgg.reduce((acc, row) => {
        acc[row._id] = row.count;
        return acc;
      }, {});

      return res.status(200).json({
        requestId: req.context.requestId,
        metrics: {
          sessionsByState,
          spotsByStatus,
          incidentsCount,
          enforcementCount,
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  // Module mounting
  app.use("/api/auth", authRoutes);
  app.use("/api/sessions", sessionRoutes);
  app.use("/api/parking", parkingRoutes);
  app.use("/api/operations", operationsRoutes);
  app.use("/api/ai", aiRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/attendant", attendantRoutes);
  app.use("/api/attendant", attendantAIExceptionRoutes);
  app.use("/api/attendant", attendantWalkupRoutes);
  app.use("/api/attendant", attendantIncidentRoutes);
  app.use("/api/attendant/shifts", attendantShiftReportsRoutes);
  app.use("/api/owner", ownerOperationsRoutes);
  app.use("/api/owner", ownerAttendantsRoutes);
  app.use("/api/uploads", uploadRoutes);
  app.use("/api/pricing", pricingRoutes);
  app.use("/api/payments", paymentRoutes);
  app.use("/api", financeRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

module.exports = {
  createApp,
};
