const dns = require("dns");
const mongoose = require("mongoose");
const { env } = require("../config/env");
const { logger } = require("../common/logger");

// Use public DNS for Atlas SRV resolution when local DNS refuses querySrv (ECONNREFUSED).
if (process.env.MONGO_URI?.startsWith("mongodb+srv://")) {
  dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
}

let isConnected = false;
let listenersRegistered = false;

const maskMongoUri = (uri) => uri.replace(/\/\/([^@/]+@)/, "//***@");

const validateMongoUri = (mongoUri) => {
  if (/<[^>]+>/.test(mongoUri)) {
    throw new Error(
      "MONGO_URI contains placeholder values. Update backend/.env with your real MongoDB Atlas username and password."
    );
  }

  if (/127\.0\.0\.1|localhost/i.test(mongoUri)) {
    throw new Error(
      "MONGO_URI points to localhost. Use your MongoDB Atlas connection string in backend/.env."
    );
  }

  const isAtlasUri =
    mongoUri.startsWith("mongodb+srv://") || /\.mongodb\.net/i.test(mongoUri);
  if (!isAtlasUri) {
    throw new Error(
      "MONGO_URI must be a MongoDB Atlas connection string (mongodb+srv://...mongodb.net/...)."
    );
  }
};

const registerConnectionListeners = () => {
  if (listenersRegistered) return;
  listenersRegistered = true;

  mongoose.connection.on("disconnected", () => {
    isConnected = false;
    logger.warn("MongoDB disconnected", {
      module: "database.mongo",
    });
  });

  mongoose.connection.on("error", (error) => {
    logger.error("MongoDB connection error", {
      module: "database.mongo",
      error: { name: error.name, message: error.message },
    });
  });
};

const connectMongo = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const mongoUri = process.env.MONGO_URI?.trim();
  if (!mongoUri) {
    const error = new Error(
      "MONGO_URI environment variable is required. Set your MongoDB Atlas connection string in backend/.env"
    );
    logger.error("MongoDB connection failed: MONGO_URI is not set", {
      module: "database.mongo",
      error: { name: error.name, message: error.message },
    });
    console.error("[VisionPark] MongoDB connection failed: MONGO_URI is not set in backend/.env");
    throw error;
  }

  validateMongoUri(mongoUri);

  try {
    await mongoose.connect(mongoUri, {
      dbName: env.mongoDbName,
      serverSelectionTimeoutMS: 15_000,
    });

    isConnected = true;
    registerConnectionListeners();

    logger.info("MongoDB connected successfully", {
      module: "database.mongo",
      dbName: env.mongoDbName,
      host: mongoose.connection.host,
      target: maskMongoUri(mongoUri),
    });

    return mongoose.connection;
  } catch (error) {
    isConnected = false;

    const failureDetails = {
      name: error.name,
      message: error.message,
      code: error.code,
    };

    logger.error("MongoDB connection failed", {
      module: "database.mongo",
      target: maskMongoUri(mongoUri),
      error: failureDetails,
    });

    console.error("[VisionPark] MongoDB connection failed.");
    console.error(`[VisionPark] ${error.message}`);
    if (error.code) {
      console.error(`[VisionPark] Error code: ${error.code}`);
    }
    console.error(
      "[VisionPark] Check MONGO_URI in backend/.env (Atlas credentials, IP whitelist, cluster URL)."
    );

    throw error;
  }
};

const disconnectMongo = async () => {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  logger.info("MongoDB disconnected by application", {
    module: "database.mongo",
  });
};

module.exports = {
  connectMongo,
  disconnectMongo,
};
