const mongoose = require("mongoose");
const { env } = require("../config/env");
const { logger } = require("../common/logger");

let isConnected = false;

const connectMongo = async () => {
  if (isConnected) return mongoose.connection;

  await mongoose.connect(env.mongoUri, {
    dbName: env.mongoDbName,
  });
  isConnected = true;
  logger.info("MongoDB connected", {
    module: "database.mongo",
    dbName: env.mongoDbName,
  });

  mongoose.connection.on("disconnected", () => {
    isConnected = false;
    logger.warn("MongoDB disconnected", {
      module: "database.mongo",
    });
  });

  return mongoose.connection;
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
