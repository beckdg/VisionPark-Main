const request = require("supertest");
const mongoose = require("mongoose");
const { createApp } = require("../../src/app");
const { ParkingSession } = require("../../src/modules/sessions/models/parking-session.model");
const { ParkingSpot } = require("../../src/modules/parking/models/parking-spot.model");
const { Transaction } = require("../../src/modules/operations/models/transaction.model");
const {
  attachEventCapture,
  detachEventCapture,
  getEvents,
  clearEvents,
  waitForEventCount,
} = require("../utils/event-capture");

const TEST_MONGO_URI =
  process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017/visionpark_integration_test";

const app = createApp();

const objectId = () => new mongoose.Types.ObjectId().toString();

const createInventory = async () => {
  const ownerId = objectId();
  const lotRes = await request(app).post("/api/parking/lots").send({
    ownerId,
    name: `lot-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    region: "Addis Ababa",
    city: "Addis Ababa",
    address: "Test Address",
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
    code: `S-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    category: "car",
  });
  expect(spotRes.status).toBe(201);

  return {
    lotId: lotRes.body._id,
    zoneId: zoneRes.body._id,
    spotId: spotRes.body._id,
  };
};

const createReservedSession = async ({ lotId, zoneId, spotId, paymentRequired = false }) => {
  const res = await request(app).post("/api/sessions/reservations").send({
    driverId: objectId(),
    lotId,
    zoneId,
    spotId,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    paymentRequired,
    idempotencyKey: `reserve-${Math.random().toString(36).slice(2)}`,
  });
  expect(res.status).toBe(201);
  return res.body;
};

beforeAll(async () => {
  await mongoose.connect(TEST_MONGO_URI, { dbName: "visionpark_integration_test" });
  attachEventCapture();
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  clearEvents();
});

afterAll(async () => {
  detachEventCapture();
  await mongoose.disconnect();
});

describe("Core backend invariants", () => {
  test("1) no double booking under parallel reservation requests", async () => {
    const { lotId, zoneId, spotId } = await createInventory();
    const payload = {
      driverId: objectId(),
      lotId,
      zoneId,
      spotId,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };

    const [a, b] = await Promise.all([
      request(app).post("/api/sessions/reservations").send(payload),
      request(app)
        .post("/api/sessions/reservations")
        .send({ ...payload, driverId: objectId() }),
    ]);

    const statuses = [a.status, b.status].sort((x, y) => x - y);
    expect(statuses).toEqual([201, 409]);
  });

  test("2) no double close: second close is idempotent", async () => {
    const { lotId, zoneId, spotId } = await createInventory();
    const session = await createReservedSession({ lotId, zoneId, spotId });

    const secureRes = await request(app)
      .post(`/api/sessions/${session._id}/secure`)
      .send({ idempotencyKey: "secure-once" });
    expect(secureRes.status).toBe(200);
    expect(secureRes.body.state).toBe("secured");

    const close1 = await request(app)
      .post(`/api/sessions/${session._id}/close`)
      .send({ idempotencyKey: "close-once", closeReason: "test-close" });
    expect(close1.status).toBe(200);
    expect(close1.body.state).toBe("closed");

    const close2 = await request(app)
      .post(`/api/sessions/${session._id}/close`)
      .send({ idempotencyKey: "close-twice", closeReason: "retry" });
    expect(close2.status).toBe(200);
    expect(close2.body.state).toBe("closed");

    const dbSession = await ParkingSession.findById(session._id).select("state closedAt");
    expect(dbSession.state).toBe("closed");
    expect(dbSession.closedAt).toBeTruthy();
  });

  test("3) single successful transaction per session", async () => {
    const { lotId, zoneId, spotId } = await createInventory();
    const session = await createReservedSession({
      lotId,
      zoneId,
      spotId,
      paymentRequired: true,
    });

    const t1 = await request(app).post("/api/operations/transactions").send({
      sessionId: session._id,
      driverId: session.driverId,
      amount: 100,
      currency: "ETB",
      method: "telebirr",
      idempotencyKey: "tx-k1",
    });
    expect(t1.status).toBe(201);

    const t2 = await request(app).post("/api/operations/transactions").send({
      sessionId: session._id,
      driverId: session.driverId,
      amount: 100,
      currency: "ETB",
      method: "telebirr",
      idempotencyKey: "tx-k2",
    });
    expect(t2.status).toBe(201);

    const complete1 = await request(app)
      .patch(`/api/operations/transactions/${t1.body._id}/complete`)
      .send({ status: "success" });
    expect(complete1.status).toBe(200);
    expect(complete1.body.status).toBe("success");

    const complete2 = await request(app)
      .patch(`/api/operations/transactions/${t2.body._id}/complete`)
      .send({ status: "success" });
    expect(complete2.status).toBe(409);

    const successCount = await Transaction.countDocuments({
      sessionId: session._id,
      status: "success",
    });
    expect(successCount).toBe(1);

    const events = await waitForEventCount(1);
    const completedEvents = events.filter(
      (event) => event.name === "transaction.completed"
    );
    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0].payload.sessionId).toBe(session._id);
  });

  test("4) spot derivation correctness for reserved/secured/expired/blocked", async () => {
    const { lotId, zoneId, spotId } = await createInventory();
    const session = await createReservedSession({ lotId, zoneId, spotId });

    let spotRes = await request(app).get(`/api/parking/spots/${spotId}`);
    expect(spotRes.status).toBe(200);
    expect(spotRes.body.status).toBe("reserved");

    const secureRes = await request(app)
      .post(`/api/sessions/${session._id}/secure`)
      .send({ idempotencyKey: "derive-secure" });
    expect(secureRes.status).toBe(200);

    spotRes = await request(app).get(`/api/parking/spots/${spotId}`);
    expect(spotRes.status).toBe(200);
    expect(spotRes.body.status).toBe("occupied");

    const blockCreate = await request(app).post("/api/operations/enforcements").send({
      targetType: "session",
      sessionId: session._id,
      spotId,
      reason: "manual hold",
      debtAmount: 0,
    });
    expect(blockCreate.status).toBe(201);

    const events = await waitForEventCount(2);
    const enforcementCreated = events.filter(
      (event) => event.name === "enforcement.created"
    );
    const enforcementBlockApplied = events.filter(
      (event) => event.name === "enforcement.block_applied"
    );
    expect(enforcementCreated).toHaveLength(1);
    expect(enforcementBlockApplied).toHaveLength(1);
    expect(enforcementCreated[0].payload.enforcementId).toBe(blockCreate.body._id);
    expect(enforcementBlockApplied[0].payload.enforcementId).toBe(
      blockCreate.body._id
    );

    spotRes = await request(app).get(`/api/parking/spots/${spotId}`);
    expect(spotRes.status).toBe(200);
    expect(spotRes.body.status).toBe("blocked");

    const clear = await request(app)
      .post(`/api/operations/enforcements/${blockCreate.body._id}/clear`)
      .send({});
    expect(clear.status).toBe(200);

    const closeRes = await request(app)
      .post(`/api/sessions/${session._id}/close`)
      .send({ idempotencyKey: "derive-close" });
    expect(closeRes.status).toBe(200);

    spotRes = await request(app).get(`/api/parking/spots/${spotId}`);
    expect(spotRes.status).toBe(200);
    expect(spotRes.body.status).toBe("free");
  });

  test("5) session state machine rejects invalid transitions", async () => {
    const { lotId, zoneId, spotId } = await createInventory();
    const session = await createReservedSession({ lotId, zoneId, spotId });

    const expired = await request(app)
      .post(`/api/sessions/${session._id}/expire`)
      .send({ idempotencyKey: "sm-expire" });
    expect(expired.status).toBe(200);
    expect(expired.body.state).toBe("expired");

    const expireToReservedEquivalent = await request(app)
      .post(`/api/sessions/${session._id}/secure`)
      .send({ idempotencyKey: "sm-invalid-expired-secure" });
    expect(expireToReservedEquivalent.status).toBe(409);

    const closed = await request(app)
      .post(`/api/sessions/${session._id}/close`)
      .send({ idempotencyKey: "sm-close" });
    expect(closed.status).toBe(200);
    expect(closed.body.state).toBe("closed");

    const closedToSecured = await request(app)
      .post(`/api/sessions/${session._id}/secure`)
      .send({ idempotencyKey: "sm-invalid-closed-secure" });
    expect(closedToSecured.status).toBe(409);

    const closedToAnyState = await request(app)
      .post(`/api/sessions/${session._id}/expire`)
      .send({ idempotencyKey: "sm-invalid-closed-expire" });
    expect(closedToAnyState.status).toBe(409);
  });

  test("6) reservation -> secured -> close emits strict session event order", async () => {
    const { lotId, zoneId, spotId } = await createInventory();
    const session = await createReservedSession({ lotId, zoneId, spotId });

    const secure = await request(app)
      .post(`/api/sessions/${session._id}/secure`)
      .send({ idempotencyKey: "evt-order-secure" });
    expect(secure.status).toBe(200);

    const close = await request(app)
      .post(`/api/sessions/${session._id}/close`)
      .send({ idempotencyKey: "evt-order-close" });
    expect(close.status).toBe(200);

    const events = await waitForEventCount(3);
    const sessionEvents = events
      .filter((event) =>
        ["session.reserved", "session.secured", "session.closed"].includes(event.name)
      )
      .map((event) => event.name);

    expect(sessionEvents).toEqual([
      "session.reserved",
      "session.secured",
      "session.closed",
    ]);
  });

  test("7) duplicate idempotent reservation does not emit duplicate session.reserved", async () => {
    const { lotId, zoneId, spotId } = await createInventory();
    const idempotencyKey = "evt-idempotent-reservation-create";
    const payload = {
      driverId: objectId(),
      lotId,
      zoneId,
      spotId,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      idempotencyKey,
    };

    const first = await request(app).post("/api/sessions/reservations").send(payload);
    const second = await request(app).post("/api/sessions/reservations").send(payload);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body._id).toBe(first.body._id);

    const events = await waitForEventCount(1);
    const createdEvents = events.filter(
      (event) => event.name === "session.reserved"
    );
    expect(createdEvents).toHaveLength(1);
  });

  test("8) POST enforcements plate + actionType clamp blocks spot; POST .../clear", async () => {
    const { spotId } = await createInventory();
    const clamp = await request(app).post("/api/operations/enforcements").send({
      spotId,
      targetType: "plate",
      plate: "OR 232321",
      actionType: "clamp",
    });
    expect(clamp.status).toBe(201);
    expect(clamp.body.status).toBe("clamped");

    const spotRes = await request(app).get(`/api/parking/spots/${spotId}`);
    expect(spotRes.status).toBe(200);
    expect(spotRes.body.status).toBe("blocked");

    const clearRes = await request(app)
      .post(`/api/operations/enforcements/${clamp.body._id}/clear`)
      .send({});
    expect(clearRes.status).toBe(200);
    expect(clearRes.body.status).toBe("cleared");

    const after = await request(app).get(`/api/parking/spots/${spotId}`);
    expect(after.body.status).toBe("free");
    expect(after.body.isBlocked).toBe(false);
  });
});
