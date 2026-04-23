const request = require("supertest");
const mongoose = require("mongoose");
const { createApp } = require("../../src/app");
const { ParkingSession } = require("../../src/modules/sessions/models/parking-session.model");
const { ParkingSpot } = require("../../src/modules/parking/models/parking-spot.model");

const TEST_MONGO_URI =
  process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017/visionpark_integration_test";

const app = createApp();

const objectId = () => new mongoose.Types.ObjectId().toString();

const createInventory = async () => {
  const lotRes = await request(app).post("/api/parking/lots").send({
    ownerId: objectId(),
    name: `lot-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    region: "Addis Ababa",
    city: "Addis Ababa",
    address: "Stress Test Address",
  });
  expect(lotRes.status).toBe(201);

  const zoneRes = await request(app).post("/api/parking/zones").send({
    lotId: lotRes.body._id,
    name: `zone-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    category: "car",
  });
  expect(zoneRes.status).toBe(201);

  const spotRes = await request(app).post("/api/parking/spots").send({
    lotId: lotRes.body._id,
    zoneId: zoneRes.body._id,
    code: `SP-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    category: "car",
  });
  expect(spotRes.status).toBe(201);

  return {
    lotId: lotRes.body._id,
    zoneId: zoneRes.body._id,
    spotId: spotRes.body._id,
  };
};

beforeAll(async () => {
  await mongoose.connect(TEST_MONGO_URI, { dbName: "visionpark_integration_test" });
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe("System resilience integration tests", () => {
  test("1) high-concurrency reservation stress: only one reservation succeeds", async () => {
    const { lotId, zoneId, spotId } = await createInventory();
    const count = 75;

    const requests = Array.from({ length: count }, (_, i) =>
      request(app)
        .post("/api/sessions/reservations")
        .send({
          driverId: objectId(),
          lotId,
          zoneId,
          spotId,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          idempotencyKey: `stress-rsv-${i}-${Math.random().toString(36).slice(2)}`,
        })
    );

    const results = await Promise.all(requests);
    const success = results.filter((r) => r.status === 201);
    const conflicts = results.filter((r) => r.status === 409);
    const other = results.filter((r) => ![201, 409].includes(r.status));

    expect(success).toHaveLength(1);
    expect(conflicts).toHaveLength(count - 1);
    expect(other).toHaveLength(0);

    const activeCount = await ParkingSession.countDocuments({
      spotId,
      state: { $in: ["reserved", "secured"] },
    });
    expect(activeCount).toBe(1);
  });

  test("2) partial failure recovery: stale spot state is self-corrected by derivation", async () => {
    const { lotId, zoneId, spotId } = await createInventory();

    // Simulate partial failure: session exists but spot update step did not run.
    const simulatedSession = await ParkingSession.create({
      driverId: objectId(),
      lotId,
      zoneId,
      spotId,
      state: "reserved",
      reservedAt: new Date(),
      expiresAt: new Date(Date.now() + 20 * 60 * 1000),
      idempotencyLog: [],
    });

    const staleSpot = await ParkingSpot.findById(spotId).select("status isBlocked");
    expect(staleSpot.status).toBe("free");
    expect(staleSpot.isBlocked).toBe(false);

    const deriveRes = await request(app).post(`/api/parking/spots/${spotId}/derive-status`).send({});
    expect(deriveRes.status).toBe(200);
    expect(deriveRes.body.status).toBe("reserved");
    expect(deriveRes.body.derivedFromSessionId).toBe(String(simulatedSession._id));
  });

  test("3) out-of-order state operations: invalid transitions are rejected", async () => {
    const { lotId, zoneId, spotId } = await createInventory();
    const reserveRes = await request(app).post("/api/sessions/reservations").send({
      driverId: objectId(),
      lotId,
      zoneId,
      spotId,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      idempotencyKey: "ooo-reserve",
    });
    expect(reserveRes.status).toBe(201);
    const sessionId = reserveRes.body._id;

    const expire = await request(app)
      .post(`/api/sessions/${sessionId}/expire`)
      .send({ idempotencyKey: "ooo-expire" });
    expect(expire.status).toBe(200);
    expect(expire.body.state).toBe("expired");

    const secureInvalid = await request(app)
      .post(`/api/sessions/${sessionId}/secure`)
      .send({ idempotencyKey: "ooo-secure-invalid" });
    expect(secureInvalid.status).toBe(409);

    const close = await request(app)
      .post(`/api/sessions/${sessionId}/close`)
      .send({ idempotencyKey: "ooo-close" });
    expect(close.status).toBe(200);
    expect(close.body.state).toBe("closed");

    const secureAfterCloseInvalid = await request(app)
      .post(`/api/sessions/${sessionId}/secure`)
      .send({ idempotencyKey: "ooo-secure-after-close" });
    expect(secureAfterCloseInvalid.status).toBe(409);
  });

  test("4) enforcement override during active session blocks spot without changing session", async () => {
    const { lotId, zoneId, spotId } = await createInventory();
    const reserveRes = await request(app).post("/api/sessions/reservations").send({
      driverId: objectId(),
      lotId,
      zoneId,
      spotId,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      idempotencyKey: "enf-override-reserve",
    });
    expect(reserveRes.status).toBe(201);
    const sessionId = reserveRes.body._id;

    const secureRes = await request(app)
      .post(`/api/sessions/${sessionId}/secure`)
      .send({ idempotencyKey: "enf-override-secure" });
    expect(secureRes.status).toBe(200);
    expect(secureRes.body.state).toBe("secured");

    let preBlockSpot = await request(app).get(`/api/parking/spots/${spotId}`);
    expect(preBlockSpot.status).toBe(200);
    expect(preBlockSpot.body.status).toBe("occupied");

    const enforcementCreate = await request(app).post("/api/operations/enforcements").send({
      targetType: "session",
      sessionId,
      spotId,
      reason: "manual enforcement override",
      debtAmount: 25,
    });
    expect(enforcementCreate.status).toBe(201);

    const sessionStillActive = await request(app).get(`/api/sessions/${sessionId}`);
    expect(sessionStillActive.status).toBe(200);
    expect(sessionStillActive.body.state).toBe("secured");

    const blockedSpot = await request(app).get(`/api/parking/spots/${spotId}`);
    expect(blockedSpot.status).toBe(200);
    expect(blockedSpot.body.status).toBe("blocked");
    expect(blockedSpot.body.isBlocked).toBe(true);
  });
});
