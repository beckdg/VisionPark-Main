/**
 * One-time migration: drop legacy unique indexes that blocked multiple successes
 * per session (e.g. reservation_fee + parking_fee). Then sync Mongoose indexes.
 *
 * Usage (from backend folder): node src/scripts/repair-transaction-indexes.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { Transaction } = require("../modules/operations/models/transaction.model");

const run = async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    // eslint-disable-next-line no-console
    console.error("Set MONGO_URI or MONGODB_URI in .env");
    process.exit(1);
  }
  await mongoose.connect(uri);
  const col = Transaction.collection;
  for (const indexName of [
    "uniq_successful_transaction_per_session",
    "uniq_legacy_success_per_session",
  ]) {
    try {
      await col.dropIndex(indexName);
      // eslint-disable-next-line no-console
      console.log(`Dropped ${indexName}`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(`Drop ${indexName} (ok if missing):`, e?.message || e);
    }
  }
  await Transaction.syncIndexes();
  // eslint-disable-next-line no-console
  console.log("Transaction indexes synced.");
  await mongoose.disconnect();
};

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
