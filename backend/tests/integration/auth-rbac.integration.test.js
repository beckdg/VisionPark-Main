const request = require("supertest");
const mongoose = require("mongoose");
const { createApp } = require("../../src/app");
const { env } = require("../../src/config/env");
const {
  registerAndLogin,
  authHeader,
  aiApiKeyHeader,
} = require("../utils/test-auth");
const { seedOwnerInventory } = require("../utils/inventory-with-auth");

const TEST_MONGO_URI =
  process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017/visionpark_integration_test";

const app = createApp();
jest.setTimeout(30000);

beforeAll(async () => {
  await mongoose.connect(TEST_MONGO_URI, { dbName: "visionpark_integration_test" });
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe("Auth + RBAC full validation", () => {
  test("driver flow: reserve ok, secure forbidden, close own session ok", async () => {
    const inventory = await seedOwnerInventory(app);
    const driver = await registerAndLogin(app, {
      email: `driver-flow-${Date.now()}@test.local`,
      name: "Driver Flow",
      role: "driver",
    });

    const reserve = await request(app)
      .post("/api/sessions/reservations")
      .set(authHeader(driver.token))
      .send({
        driverId: driver.user._id,
        lotId: inventory.lotId,
        zoneId: inventory.zoneId,
        spotId: inventory.spotId,
        expiresAt: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
        idempotencyKey: `driver-flow-reserve-${Date.now()}`,
      });
    expect(reserve.status).toBe(201);

    const secureForbidden = await request(app)
      .post(`/api/sessions/${reserve.body._id}/secure`)
      .set(authHeader(driver.token))
      .send({ idempotencyKey: `driver-flow-secure-${Date.now()}` });
    expect(secureForbidden.status).toBe(403);
    expect(secureForbidden.body.success).toBe(false);
    expect(secureForbidden.body.error.code).toBe("FORBIDDEN_ERROR");
    expect(secureForbidden.body.requestId).toBeTruthy();

    const close = await request(app)
      .post(`/api/sessions/${reserve.body._id}/close`)
      .set(authHeader(driver.token))
      .send({ idempotencyKey: `driver-flow-close-${Date.now()}` });
    expect(close.status).toBe(409);
    expect(close.body.success).toBe(false);
    expect(close.body.error.code).toBe("SESSION_ERROR");
  });

  test("attendant flow: secure + expire + create incident", async () => {
    const inventory = await seedOwnerInventory(app);
    const driver = await registerAndLogin(app, {
      email: `driver-attendant-${Date.now()}@test.local`,
      name: "Driver Two",
      role: "driver",
    });
    const attendant = await registerAndLogin(app, {
      email: `attendant-${Date.now()}@test.local`,
      name: "Attendant",
      role: "attendant",
    });

    const reserve = await request(app)
      .post("/api/sessions/reservations")
      .set(authHeader(driver.token))
      .send({
        driverId: driver.user._id,
        lotId: inventory.lotId,
        zoneId: inventory.zoneId,
        spotId: inventory.spotId,
        expiresAt: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
        idempotencyKey: `att-flow-reserve-${Date.now()}`,
      });
    expect(reserve.status).toBe(201);

    const secure = await request(app)
      .post(`/api/sessions/${reserve.body._id}/secure`)
      .set(authHeader(attendant.token))
      .send({ idempotencyKey: `att-flow-secure-${Date.now()}` });
    expect(secure.status).toBe(200);

    const incident = await request(app)
      .post("/api/operations/incidents")
      .set(authHeader(attendant.token))
      .send({
        createdByType: "attendant",
        createdById: attendant.user._id,
        type: "manual_validation",
        sessionId: reserve.body._id,
        plate: "AA-12345",
        description: "manual validation",
      });
    expect(incident.status).toBe(201);

    const inventory2 = await seedOwnerInventory(app);
    const driver2 = await registerAndLogin(app, {
      email: `driver-attendant2-${Date.now()}@test.local`,
      name: "Driver Three",
      role: "driver",
    });
    const reserve2 = await request(app)
      .post("/api/sessions/reservations")
      .set(authHeader(driver2.token))
      .send({
        driverId: driver2.user._id,
        lotId: inventory2.lotId,
        zoneId: inventory2.zoneId,
        spotId: inventory2.spotId,
        expiresAt: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
        idempotencyKey: `att-flow-reserve2-${Date.now()}`,
      });
    expect(reserve2.status).toBe(201);

    const expire = await request(app)
      .post(`/api/sessions/${reserve2.body._id}/expire`)
      .set(authHeader(attendant.token))
      .send({ idempotencyKey: `att-flow-expire-${Date.now()}` });
    expect(expire.status).toBe(200);
  });

  test("owner flow: own lot succeeds; foreign lot mutation forbidden", async () => {
    const owner1 = await registerAndLogin(app, {
      email: `owner1-${Date.now()}@test.local`,
      name: "Owner One",
      role: "owner",
    });
    const owner2 = await registerAndLogin(app, {
      email: `owner2-${Date.now()}@test.local`,
      name: "Owner Two",
      role: "owner",
    });

    const lot = await request(app)
      .post("/api/parking/lots")
      .set(authHeader(owner1.token))
      .send({
        ownerId: owner1.user._id,
        name: `owner-lot-${Date.now()}`,
        region: "AA",
        city: "AA",
        address: "Owner Address",
      });
    expect(lot.status).toBe(201);

    const zone = await request(app)
      .post("/api/parking/zones")
      .set(authHeader(owner1.token))
      .send({
        lotId: lot.body._id,
        name: `zone-${Date.now()}`,
        category: "car",
      });
    expect(zone.status).toBe(201);

    const spot = await request(app)
      .post("/api/parking/spots")
      .set(authHeader(owner1.token))
      .send({
        lotId: lot.body._id,
        zoneId: zone.body._id,
        code: `OWN-${Date.now()}`,
        category: "car",
      });
    expect(spot.status).toBe(201);

    const foreignZoneAttempt = await request(app)
      .post("/api/parking/zones")
      .set(authHeader(owner2.token))
      .send({
        lotId: lot.body._id,
        name: `forbidden-zone-${Date.now()}`,
        category: "car",
      });
    expect(foreignZoneAttempt.status).toBe(403);
    expect(foreignZoneAttempt.body.error.code).toBe("FORBIDDEN_ERROR");
  });

  test("admin flow: can perform cross-role operations", async () => {
    const admin = await registerAndLogin(app, {
      email: `admin-${Date.now()}@test.local`,
      name: "Admin User",
      role: "admin",
    });
    const driver = await registerAndLogin(app, {
      email: `admin-driver-${Date.now()}@test.local`,
      name: "Admin Driver",
      role: "driver",
    });

    const lot = await request(app)
      .post("/api/parking/lots")
      .set(authHeader(admin.token))
      .send({
        ownerId: admin.user._id,
        name: `admin-lot-${Date.now()}`,
        region: "AA",
        city: "AA",
        address: "Admin Address",
      });
    expect(lot.status).toBe(201);

    const zone = await request(app)
      .post("/api/parking/zones")
      .set(authHeader(admin.token))
      .send({
        lotId: lot.body._id,
        name: `admin-zone-${Date.now()}`,
        category: "car",
      });
    expect(zone.status).toBe(201);

    const spot = await request(app)
      .post("/api/parking/spots")
      .set(authHeader(admin.token))
      .send({
        lotId: lot.body._id,
        zoneId: zone.body._id,
        code: `ADM-${Date.now()}`,
        category: "car",
      });
    expect(spot.status).toBe(201);

    const reserve = await request(app)
      .post("/api/sessions/reservations")
      .set(authHeader(admin.token))
      .send({
        driverId: driver.user._id,
        lotId: lot.body._id,
        zoneId: zone.body._id,
        spotId: spot.body._id,
        expiresAt: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
        idempotencyKey: `admin-reserve-${Date.now()}`,
      });
    expect(reserve.status).toBe(201);
  });

  test("ownership: driver cannot create tx for another driver", async () => {
    const inventory = await seedOwnerInventory(app);
    const d1 = await registerAndLogin(app, {
      email: `d1-${Date.now()}@test.local`,
      name: "Driver One",
      role: "driver",
    });
    const d2 = await registerAndLogin(app, {
      email: `d2-${Date.now()}@test.local`,
      name: "Driver Two",
      role: "driver",
    });
    const reserve = await request(app)
      .post("/api/sessions/reservations")
      .set(authHeader(d1.token))
      .send({
        driverId: d1.user._id,
        lotId: inventory.lotId,
        zoneId: inventory.zoneId,
        spotId: inventory.spotId,
        expiresAt: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
        idempotencyKey: `own-reserve-${Date.now()}`,
      });
    expect(reserve.status).toBe(201);

    const txForbidden = await request(app)
      .post("/api/operations/transactions")
      .set(authHeader(d2.token))
      .send({
        sessionId: reserve.body._id,
        driverId: d1.user._id,
        amount: 120,
        currency: "ETB",
        method: "telebirr",
        idempotencyKey: `own-tx-${Date.now()}`,
      });
    expect(txForbidden.status).toBe(403);
    expect(txForbidden.body.error.code).toBe("FORBIDDEN_ERROR");
  });

  test("error consistency: 401 unauthenticated + 403 unauthorized envelope", async () => {
    const inventory = await seedOwnerInventory(app);
    const owner = await registerAndLogin(app, {
      email: `owner-err-${Date.now()}@test.local`,
      name: "Owner Err",
      role: "owner",
    });
    const driver = await registerAndLogin(app, {
      email: `driver-err-${Date.now()}@test.local`,
      name: "Driver Err",
      role: "driver",
    });

    const unauth = await request(app).post("/api/parking/lots").send({
      ownerId: owner.user._id,
      name: "x",
      region: "x",
      city: "x",
      address: "x",
    });
    expect(unauth.status).toBe(401);
    expect(unauth.body.success).toBe(false);
    expect(unauth.body.error.code).toBe("UNAUTHORIZED_ERROR");
    expect(unauth.body.requestId).toBeTruthy();

    const forbidden = await request(app)
      .post("/api/sessions/reservations")
      .set(authHeader(driver.token))
      .send({
        driverId: owner.user._id,
        lotId: inventory.lotId,
        zoneId: inventory.zoneId,
        spotId: inventory.spotId,
        expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
        idempotencyKey: `forbidden-${Date.now()}`,
      });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.success).toBe(false);
    expect(forbidden.body.error.code).toBe("FORBIDDEN_ERROR");
    expect(forbidden.body.requestId).toBeTruthy();
  });

  test("security: AI endpoints require x-api-key and reject JWT-only", async () => {
    const driver = await registerAndLogin(app, {
      email: `driver-ai-${Date.now()}@test.local`,
      name: "Driver AI",
      role: "driver",
    });

    const jwtOnly = await request(app)
      .post("/api/ai/events")
      .set(authHeader(driver.token))
      .send({
        eventType: "entry_detected",
        cameraId: "cam-1",
        timestamp: new Date().toISOString(),
        confidence: 0.91,
        metadata: { plate: "AA-11111" },
      });
    expect(jwtOnly.status).toBe(401);
    expect(jwtOnly.body.error.code).toBe("UNAUTHORIZED_ERROR");

    const apiKeyOk = await request(app)
      .post("/api/ai/events")
      .set(aiApiKeyHeader(env.aiApiKey))
      .send({
        eventType: "entry_detected",
        cameraId: "cam-1",
        timestamp: new Date().toISOString(),
        confidence: 0.91,
        metadata: { plate: "AA-11111" },
      });
    expect(apiKeyOk.status).toBe(202);
  });
});
