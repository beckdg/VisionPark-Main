const path = require("path");
const { ValidationError } = require("../common/errors");

const loadEnv = () => {
  // Optional dotenv support if installed; keeps bootstrap flexible.
  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const dotenv = require("dotenv");
    // Prefer backend/.env regardless of process.cwd() (e.g. dev from monorepo root or frontend/).
    const backendRootEnv = path.resolve(__dirname, "../../.env");
    dotenv.config({ path: backendRootEnv });
    dotenv.config({ path: path.resolve(process.cwd(), ".env") });
  } catch (_error) {
    // No-op when dotenv is not present.
  }
};

loadEnv();

const parsePort = (value) => {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : null;
};

const requireString = (value, key) => {
  if (!value || typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`Missing required environment variable: ${key}`);
  }
  return value.trim();
};

const nodeEnv = process.env.NODE_ENV || "development";
const allowedEnvs = ["development", "staging", "production", "test"];
if (!allowedEnvs.includes(nodeEnv)) {
  throw new ValidationError(`Invalid NODE_ENV. Allowed: ${allowedEnvs.join(", ")}`);
}

const defaultMongoUriByEnv = {
  development: "mongodb://127.0.0.1:27017/visionpark",
  test: "mongodb://127.0.0.1:27017/visionpark_test",
  staging: null,
  production: null,
};

const rawMongoUri = process.env.MONGO_URI || defaultMongoUriByEnv[nodeEnv];
if (!rawMongoUri) {
  throw new ValidationError("MONGO_URI is required for staging/production environments.");
}

const defaultJwtSecretByEnv = {
  development: "dev-only-change-me-in-env",
  test: "test-jwt-secret-visionpark",
  staging: null,
  production: null,
};

const rawJwtSecret = process.env.JWT_SECRET || defaultJwtSecretByEnv[nodeEnv];
if (!rawJwtSecret) {
  throw new ValidationError("JWT_SECRET is required for staging/production environments.");
}

const defaultAiApiKeyByEnv = {
  development: "dev-ai-api-key-change-me",
  test: "test-ai-api-key-visionpark",
  staging: null,
  production: null,
};

const rawAiApiKey = process.env.AI_API_KEY || defaultAiApiKeyByEnv[nodeEnv];
if (!rawAiApiKey) {
  throw new ValidationError("AI_API_KEY is required for staging/production environments.");
}

const rawPort = process.env.PORT || 4000;
const parsedPort = parsePort(rawPort);
if (!parsedPort) {
  throw new ValidationError("PORT must be a valid integer between 1 and 65535.");
}

const rawCorsAllowedOrigins = process.env.CORS_ALLOWED_ORIGINS || "*";
const corsAllowedOrigins = rawCorsAllowedOrigins
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const env = {
  nodeEnv,
  isProduction: nodeEnv === "production",
  isStaging: nodeEnv === "staging",
  isDevelopment: nodeEnv === "development",
  isTest: nodeEnv === "test",
  port: parsedPort,
  mongoUri: requireString(rawMongoUri, "MONGO_URI"),
  mongoDbName: process.env.MONGO_DB_NAME || (nodeEnv === "test" ? "visionpark_test" : "visionpark"),
  reservationExpiryJobMs: Number(process.env.RESERVATION_EXPIRY_JOB_MS || 15000),
  reconciliationJobMs: Number(process.env.RECONCILIATION_JOB_MS || 30000),
  jwtSecret: requireString(rawJwtSecret, "JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  aiApiKey: requireString(rawAiApiKey, "AI_API_KEY"),
  corsAllowedOrigins,
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME?.trim() || null,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY?.trim() || null,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET?.trim() || null,
};

module.exports = { env };
