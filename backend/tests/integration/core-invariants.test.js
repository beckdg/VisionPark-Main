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
const {
  seedOwnerInventory,
  seedDriver,
  seedAttendant,
  authHeader,
} = require("../utils/inventory-with-auth");

const TEST_MONGO_URI =
  process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017/visionpark_integration_test";

const app = createApp();
jest.setTimeout(30000);

const createInventory = async () => seedOwnerInventory(app);

const createReservedSession = async ({
  lotId,
  zoneId,
  spotId,
  paymentRequired = false,
  driverSuffix = "drv",
}) => {
  const driver = await seedDriver(app, driverSuffix);
  const res = await request(app)
    .post("/api/sessions/reservations")
    .set(authHeader(driver.token))
    .send({
      driverId: driver.user._id,
      lotId,
      zoneId,
      spotId,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      paymentRequired,
      idempotencyKey: `reserve-${Math.random().toString(36).slice(2)}`,
    });
  expect(res.status).toBe(201);
  return { ...res.body, driverToken: driver.token };
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
    const driverA = await seedDriver(app, "a");
    const driverB = await seedDriver(app, "b");
    const payload = {
      lotId,
      zoneId,
      spotId,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };

    const [a, b] = await Promise.all([
      request(app)
        .post("/api/sessions/reservations")
        .set(authHeader(driverA.token))
        .send({ ...payload, driverId: driverA.user._id }),
      request(app)
        .post("/api/sessions/reservations")
        .set(authHeader(driverB.token))
        .send({ ...payload, driverId: driverB.user._id }),
    ]);

    const statuses = [a.status, b.status].sort((x, y) => x - y);
    expect(statuses).toEqual([201, 409]);
  });

  test("2) no double close: second close is idempotent", async () => {
    const { lotId, zoneId, spotId } = await createInventory();
    const session = await createReservedSession({ lotId, zoneId, spotId });
    const attendant = await seedAttendant(app, "close-test");

    const secureRes = await request(app)
      .post(`/api/sessions/${session._id}/secure`)
      .set(authHeader(attendant.token))
      .send({ idempotencyKey: "secure-once" });
    expect(secureRes.status).toBe(200);
    expect(secureRes.body.state).toBe("secured");

    const close1 = await request(app)
      .post(`/api/sessions/${session._id}/close`)
      .set(authHeader(session.driverToken))
      .send({ idempotencyKey: "close-once", closeReason: "test-close" });
    expect(close1.status).toBe(200);
    expect(close1.body.state).toBe("closed");

    const close2 = await request(app)
      .post(`/api/sessions/${session._id}/close`)
      .set(authHeader(session.driverToken))
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

    const t1 = await request(app)
      .post("/api/operations/transactions")
      .set(authHeader(session.driverToken))
      .send({
        sessionId: session._id,
        driverId: session.driverId,
        amount: 100,
        currency: "ETB",
        method: "telebirr",
        idempotencyKey: "tx-k1",
      });
    expect(t1.status).toBe(201);

    const t2 = await request(app)
      .post("/api/operations/transactions")
      .set(authHeader(session.driverToken))
      .send({
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
      .set(authHeader(session.driverToken))
      .send({ status: "success" });
    expect(complete1.status).toBe(200);
    expect(complete1.body.status).toBe("success");

    const complete2 = await request(app)
      .patch(`/api/operations/transactions/${t2.body._id}/complete`)
      .set(authHeader(session.driverToken))
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
    const { lotId, zoneId, spotId, ownerHeader } = await createInventory();
    const session = await createReservedSession({ lotId, zoneId, spotId });
    const attendant = await seedAttendant(app, "derive");

    let spotRes = await request(app)
      .get(`/api/parking/spots/${spotId}`)
      .set(ownerHeader);
    expect(spotRes.status).toBe(200);
    expect(spotRes.body.status).toBe("reserved");

    const secureRes = await request(app)
      .post(`/api/sessions/${session._id}/secure`)
      .set(authHeader(attendant.token))
      .send({ idempotencyKey: "derive-secure" });
    expect(secureRes.status).toBe(200);

    spotRes = await request(app)
      .get(`/api/parking/spots/${spotId}`)
      .set(ownerHeader);
    expect(spotRes.status).toBe(200);
    expect(spotRes.body.status).toBe("occupied");

    const blockCreate = await request(app)
      .post("/api/operations/enforcements")
      .set(authHeader(attendant.token))
      .send({
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

    spotRes = await request(app)
      .get(`/api/parking/spots/${spotId}`)
      .set(ownerHeader);
    expect(spotRes.status).toBe(200);
    expect(spotRes.body.status).toBe("blocked");

    const clear = await request(app)
      .post(`/api/operations/enforcements/${blockCreate.body._id}/clear`)
      .set(authHeader(attendant.token))
      .send({});
    expect(clear.status).toBe(200);

    const closeRes = await request(app)
      .post(`/api/sessions/${session._id}/close`)
      .set(authHeader(session.driverToken))
      .send({ idempotencyKey: "derive-close" });
    expect(closeRes.status).toBe(200);

    spotRes = await request(app)
      .get(`/api/parking/spots/${spotId}`)
      .set(ownerHeader);
    expect(spotRes.status).toBe(200);
    expect(spotRes.body.status).toBe("free");
  });

  test("5) session state machine rejects invalid transitions", async () => {
    const { lotId, zoneId, spotId } = await createInventory();
    const session = await createReservedSession({ lotId, zoneId, spotId });
    const attendant = await seedAttendant(app, "sm");

    const expired = await request(app)
      .post(`/api/sessions/${session._id}/expire`)
      .set(authHeader(attendant.token))
      .send({ idempotencyKey: "sm-expire" });
    expect(expired.status).toBe(200);
    expect(expired.body.state).toBe("expired");

    const expireToReservedEquivalent = await request(app)
      .post(`/api/sessions/${session._id}/secure`)
      .set(authHeader(attendant.token))
      .send({ idempotencyKey: "sm-invalid-expired-secure" });
    expect(expireToReservedEquivalent.status).toBe(409);

    const closed = await request(app)
      .post(`/api/sessions/${session._id}/close`)
      .set(authHeader(session.driverToken))
      .send({ idempotencyKey: "sm-close" });
    expect(closed.status).toBe(200);
    expect(closed.body.state).toBe("closed");

    const closedToSecured = await request(app)
      .post(`/api/sessions/${session._id}/secure`)
      .set(authHeader(attendant.token))
      .send({ idempotencyKey: "sm-invalid-closed-secure" });
    expect(closedToSecured.status).toBe(409);

    const closedToAnyState = await request(app)
      .post(`/api/sessions/${session._id}/expire`)
      .set(authHeader(attendant.token))
      .send({ idempotencyKey: "sm-invalid-closed-expire" });
    expect(closedToAnyState.status).toBe(409);
  });

  test("6) reservation -> secured -> close emits strict session event order", async () => {
    const { lotId, zoneId, spotId } = await createInventory();
    const session = await createReservedSession({ lotId, zoneId, spotId });
    const attendant = await seedAttendant(app, "evt-order");

    const secure = await request(app)
      .post(`/api/sessions/${session._id}/secure`)
      .set(authHeader(attendant.token))
      .send({ idempotencyKey: "evt-order-secure" });
    expect(secure.status).toBe(200);

    const close = await request(app)
      .post(`/api/sessions/${session._id}/close`)
      .set(authHeader(session.driverToken))
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
    const driver = await seedDriver(app, "idem");
    const idempotencyKey = "evt-idempotent-reservation-create";
    const payload = {
      driverId: driver.user._id,
      lotId,
      zoneId,
      spotId,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      idempotencyKey,
    };

    const first = await request(app)
      .post("/api/sessions/reservations")
      .set(authHeader(driver.token))
      .send(payload);
    const second = await request(app)
      .post("/api/sessions/reservations")
      .set(authHeader(driver.token))
      .send(payload);
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
    const { spotId, ownerHeader } = await createInventory();
    const attendant = await seedAttendant(app, "clamp");
    const clamp = await request(app)
      .post("/api/operations/enforcements")
      .set(authHeader(attendant.token))
      .send({
        spotId,
        targetType: "plate",
        plate: "OR 232321",
        actionType: "clamp",
      });
    expect(clamp.status).toBe(201);
    expect(clamp.body.status).toBe("clamped");

    const spotRes = await request(app)
      .get(`/api/parking/spots/${spotId}`)
      .set(ownerHeader);
    expect(spotRes.status).toBe(200);
    expect(spotRes.body.status).toBe("blocked");

    const clearRes = await request(app)
      .post(`/api/operations/enforcements/${clamp.body._id}/clear`)
      .set(authHeader(attendant.token))
      .send({});
    expect(clearRes.status).toBe(200);
    expect(clearRes.body.status).toBe("cleared");

    const after = await request(app)
      .get(`/api/parking/spots/${spotId}`)
      .set(ownerHeader);
    expect(after.body.status).toBe("free");
    expect(after.body.isBlocked).toBe(false);
  });
});
