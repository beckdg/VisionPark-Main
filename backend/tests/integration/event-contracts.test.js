const request = require("supertest");
const mongoose = require("mongoose");
const { createApp } = require("../../src/app");
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

describe("Domain event contracts", () => {
  test("session lifecycle emits reserved, secured, expired, closed events", async () => {
    const attendant = await seedAttendant(app, "evt-lifecycle");
    const { lotId, zoneId, spotId } = await createInventory();
    const driver1 = await seedDriver(app, "evt-d1");
    const reserve = await request(app)
      .post("/api/sessions/reservations")
      .set(authHeader(driver1.token))
      .send({
        driverId: driver1.user._id,
        lotId,
        zoneId,
        spotId,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        idempotencyKey: "evt-session-reserve",
      });
    expect(reserve.status).toBe(201);

    const secure = await request(app)
      .post(`/api/sessions/${reserve.body._id}/secure`)
      .set(authHeader(attendant.token))
      .send({ idempotencyKey: "evt-session-secure" });
    expect(secure.status).toBe(200);

    const close = await request(app)
      .post(`/api/sessions/${reserve.body._id}/close`)
      .set(authHeader(driver1.token))
      .send({ idempotencyKey: "evt-session-close" });
    expect(close.status).toBe(200);

    const { lotId: lot2, zoneId: zone2, spotId: spot2 } = await createInventory();
    const driver2 = await seedDriver(app, "evt-d2");
    const reserve2 = await request(app)
      .post("/api/sessions/reservations")
      .set(authHeader(driver2.token))
      .send({
        driverId: driver2.user._id,
        lotId: lot2,
        zoneId: zone2,
        spotId: spot2,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        idempotencyKey: "evt-session-reserve-2",
      });
    expect(reserve2.status).toBe(201);

    const expire = await request(app)
      .post(`/api/sessions/${reserve2.body._id}/expire`)
      .set(authHeader(attendant.token))
      .send({ idempotencyKey: "evt-session-expire" });
    expect(expire.status).toBe(200);

    const events = await waitForEventCount(4);
    const sessionEvents = events.filter((event) =>
      ["session.reserved", "session.secured", "session.expired", "session.closed"].includes(
        event.name
      )
    );

    const names = sessionEvents.map((event) => event.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "session.reserved",
        "session.secured",
        "session.expired",
        "session.closed",
      ])
    );
  });

  test("session event ordering is strict for reservation -> secured -> close", async () => {
    const { lotId, zoneId, spotId } = await createInventory();
    const driver = await seedDriver(app, "evt-order");
    const attendant = await seedAttendant(app, "evt-order-a");
    const reserve = await request(app)
      .post("/api/sessions/reservations")
      .set(authHeader(driver.token))
      .send({
        driverId: driver.user._id,
        lotId,
        zoneId,
        spotId,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        idempotencyKey: "evt-session-order-reserve",
      });
    expect(reserve.status).toBe(201);

    const secure = await request(app)
      .post(`/api/sessions/${reserve.body._id}/secure`)
      .set(authHeader(attendant.token))
      .send({ idempotencyKey: "evt-session-order-secure" });
    expect(secure.status).toBe(200);

    const close = await request(app)
      .post(`/api/sessions/${reserve.body._id}/close`)
      .set(authHeader(driver.token))
      .send({ idempotencyKey: "evt-session-order-close" });
    expect(close.status).toBe(200);

    const events = await waitForEventCount(3);
    const ordered = events
      .filter((event) =>
        ["session.reserved", "session.secured", "session.closed"].includes(event.name)
      )
      .map((event) => event.name);
    expect(ordered).toEqual(["session.reserved", "session.secured", "session.closed"]);
  });

  test("enforcement emits enforcement.created then enforcement.block_applied in order", async () => {
    const { lotId, zoneId, spotId } = await createInventory();
    const driver = await seedDriver(app, "evt-enf");
    const attendant = await seedAttendant(app, "evt-enf");
    const reserve = await request(app)
      .post("/api/sessions/reservations")
      .set(authHeader(driver.token))
      .send({
        driverId: driver.user._id,
        lotId,
        zoneId,
        spotId,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        idempotencyKey: "evt-enf-reserve",
      });
    expect(reserve.status).toBe(201);

    const create = await request(app)
      .post("/api/operations/enforcements")
      .set(authHeader(attendant.token))
      .send({
        targetType: "session",
        sessionId: reserve.body._id,
        spotId,
        reason: "event contract check",
      });
    expect(create.status).toBe(201);

    const events = await waitForEventCount(2);
    const names = events.map((event) => event.name);
    const createIdx = names.indexOf("enforcement.created");
    const blockIdx = names.indexOf("enforcement.block_applied");
    expect(createIdx).toBeGreaterThanOrEqual(0);
    expect(blockIdx).toBeGreaterThan(createIdx);
  });

  test("transaction completion emits single transaction.completed and is replay-safe", async () => {
    const { lotId, zoneId, spotId } = await createInventory();
    const driver = await seedDriver(app, "evt-tx");
    const reserve = await request(app)
      .post("/api/sessions/reservations")
      .set(authHeader(driver.token))
      .send({
        driverId: driver.user._id,
        lotId,
        zoneId,
        spotId,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        paymentRequired: true,
        idempotencyKey: "evt-tx-reserve",
      });
    expect(reserve.status).toBe(201);

    const tx = await request(app)
      .post("/api/operations/transactions")
      .set(authHeader(driver.token))
      .send({
        sessionId: reserve.body._id,
        driverId: reserve.body.driverId,
        amount: 150,
        currency: "ETB",
        method: "telebirr",
        idempotencyKey: "evt-tx-create",
      });
    expect(tx.status).toBe(201);

    const complete1 = await request(app)
      .patch(`/api/operations/transactions/${tx.body._id}/complete`)
      .set(authHeader(driver.token))
      .send({ status: "success" });
    expect(complete1.status).toBe(200);

    const completeRetry = await request(app)
      .patch(`/api/operations/transactions/${tx.body._id}/complete`)
      .set(authHeader(driver.token))
      .send({ status: "success" });
    expect(completeRetry.status).toBe(200);

    const events = await waitForEventCount(1);
    const completedEvents = events.filter(
      (event) => event.name === "transaction.completed"
    );
    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0].payload.sessionId).toBe(reserve.body._id);
  });

  test("duplicate idempotent reservation requests emit single session.reserved event", async () => {
    const { lotId, zoneId, spotId } = await createInventory();
    const driver = await seedDriver(app, "evt-idem");
    const payload = {
      driverId: driver.user._id,
      lotId,
      zoneId,
      spotId,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      idempotencyKey: "evt-reserve-idempotent",
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
    const created = events.filter((event) => event.name === "session.reserved");
    expect(created).toHaveLength(1);
  });
});
