const { connectMongo, disconnectMongo } = require("../database/mongo");
const { logger } = require("../common/logger");
const { User } = require("../modules/users/models/user.model");
const { hashPassword } = require("../modules/auth/auth.utils");
const { ParkingLot } = require("../modules/parking/models/parking-lot.model");
const { ParkingZone } = require("../modules/parking/models/parking-zone.model");
const { ParkingSpot } = require("../modules/parking/models/parking-spot.model");
const { ParkingSession } = require("../modules/sessions/models/parking-session.model");

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || "VisionParkDemo!2026";

const upsertUser = async ({ email, name, role }) => {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const normalizedEmail = String(email).trim().toLowerCase();
  let user = await User.findOne({ email: normalizedEmail }).select("+passwordHash");
  if (user) {
    user.name = name;
    user.role = role;
    user.passwordHash = passwordHash;
    user.status = "active";
    await user.save();
  } else {
    user = await User.create({
      name,
      email: normalizedEmail,
      role,
      passwordHash,
      status: "active",
    });
  }
  return user;
};

const ensureSampleSession = async ({ driverId, lotId, zoneId, spotId, state, expiresAt, tag }) => {
  const existing = await ParkingSession.findOne({
    driverId,
    lotId,
    zoneId,
    spotId,
    closeReason: tag,
  });
  if (existing) return existing;

  return ParkingSession.create({
    driverId,
    lotId,
    zoneId,
    spotId,
    state,
    expiresAt,
    reservedAt: new Date(),
    closeReason: tag,
  });
};

const run = async () => {
  await connectMongo();
  logger.info("Seeding demo data started", { module: "scripts.seed" });

  const admin = await upsertUser({
    email: "admin@visionpark.demo",
    name: "Demo Admin",
    role: "admin",
  });
  const owner = await upsertUser({
    email: "owner@visionpark.demo",
    name: "Demo Owner",
    role: "owner",
  });
  const driver1 = await upsertUser({
    email: "driver1@visionpark.demo",
    name: "Demo Driver 1",
    role: "driver",
  });
  const driver2 = await upsertUser({
    email: "driver2@visionpark.demo",
    name: "Demo Driver 2",
    role: "driver",
  });
  await upsertUser({
    email: "attendant@visionpark.demo",
    name: "Demo Attendant",
    role: "attendant",
  });

  let lot = await ParkingLot.findOne({ ownerId: owner._id, name: "VisionPark Demo Lot" });
  if (!lot) {
    lot = await ParkingLot.create({
      ownerId: owner._id,
      name: "VisionPark Demo Lot",
      region: "Addis Ababa",
      city: "Addis Ababa",
      address: "Bole Atlas",
      isActive: true,
    });
  }

  const zoneNames = ["Zone-A", "Zone-B"];
  const zones = [];
  for (const name of zoneNames) {
    let zone = await ParkingZone.findOne({ lotId: lot._id, name });
    if (!zone) {
      zone = await ParkingZone.create({
        lotId: lot._id,
        name,
        category: "car",
      });
    }
    zones.push(zone);
  }

  const spotDefinitions = [
    { zoneId: zones[0]._id, code: "A-01" },
    { zoneId: zones[0]._id, code: "A-02" },
    { zoneId: zones[1]._id, code: "B-01" },
    { zoneId: zones[1]._id, code: "B-02" },
  ];

  const spots = [];
  for (const def of spotDefinitions) {
    let spot = await ParkingSpot.findOne({
      lotId: lot._id,
      zoneId: def.zoneId,
      code: def.code,
    });
    if (!spot) {
      spot = await ParkingSpot.create({
        lotId: lot._id,
        zoneId: def.zoneId,
        code: def.code,
        category: "car",
      });
    }
    spots.push(spot);
  }

  await ensureSampleSession({
    driverId: driver1._id,
    lotId: lot._id,
    zoneId: zones[0]._id,
    spotId: spots[0]._id,
    state: "reserved",
    expiresAt: new Date(Date.now() + 20 * 60 * 1000),
    tag: "seed:reserved",
  });

  await ensureSampleSession({
    driverId: driver2._id,
    lotId: lot._id,
    zoneId: zones[0]._id,
    spotId: spots[1]._id,
    state: "secured",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    tag: "seed:secured",
  });

  logger.info("Seeding demo data completed", {
    module: "scripts.seed",
    adminId: String(admin._id),
    ownerId: String(owner._id),
    driverIds: [String(driver1._id), String(driver2._id)],
    lotId: String(lot._id),
    zones: zones.map((z) => String(z._id)),
    spots: spots.map((s) => String(s._id)),
    demoPasswordSource: process.env.SEED_DEMO_PASSWORD ? "SEED_DEMO_PASSWORD" : "built-in default (see README)",
  });
};

run()
  .catch((error) => {
    logger.error("Seed script failed", { module: "scripts.seed", error });
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectMongo();
  });
