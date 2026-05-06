const { env } = require("../../config/env");

const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const MIN_LEVEL = env.nodeEnv === "production" ? "info" : "debug";

const shouldLog = (level) => LEVELS[level] >= LEVELS[MIN_LEVEL];

const toSerializableError = (error) => {
  if (!error) return undefined;
  return {
    name: error.name,
    message: error.message,
    stack: env.nodeEnv === "production" ? undefined : error.stack,
    code: error.code,
    statusCode: error.statusCode,
  };
};

const write = (level, message, context = {}) => {
  if (!shouldLog(level)) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    module: context.module || "app",
    requestId: context.requestId || null,
    userId: context.userId || null,
    ...context,
  };
  if (entry.error instanceof Error) {
    entry.error = toSerializableError(entry.error);
  }
  process.stdout.write(`${JSON.stringify(entry)}\n`);
};

const logger = {
  debug: (message, context) => write("debug", message, context),
  info: (message, context) => write("info", message, context),
  warn: (message, context) => write("warn", message, context),
  error: (message, context) => write("error", message, context),
};

module.exports = {
  logger,
};
