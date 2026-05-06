const { InternalServerError } = require("../../common/errors");
const { logger } = require("../../common/logger");
const { env } = require("../../config/env");

const errorHandler = (err, req, res, _next) => {
  const normalizedError =
    err && typeof err.statusCode === "number"
      ? err
      : new InternalServerError(err?.message || "Internal Server Error");

  const statusCode = Number(normalizedError.statusCode || normalizedError.status || 500);
  const requestId = req?.context?.requestId || null;
  const userId = req?.context?.userId || null;
  const code = normalizedError.code || "INTERNAL_SERVER_ERROR";

  if (statusCode >= 500) {
    logger.error("Unhandled application error", {
      module: "app.error-handler",
      requestId,
      userId,
      error: normalizedError,
    });
  } else {
    logger.warn("Handled application error", {
      module: "app.error-handler",
      requestId,
      userId,
      code,
      message: normalizedError.message,
    });
  }

  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: normalizedError.message || "Internal Server Error",
      ...(env.isProduction ? {} : { details: normalizedError.details || null }),
    },
    requestId,
  });
};

const notFoundHandler = (req, res) => {
  return res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND_ERROR",
      message: "Route not found",
    },
    requestId: req?.context?.requestId || null,
  });
};

module.exports = {
  errorHandler,
  notFoundHandler,
};
