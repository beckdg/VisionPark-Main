const request = require("supertest");
const mongoose = require("mongoose");
const { createApp } = require("../../src/app");
const { authHeader, verifyDriverEmailForTests } = require("../utils/test-auth");

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

describe("Auth API", () => {
  test("register then login returns JWT; /me returns user", async () => {
    const email = `u-${Date.now()}@test.local`;
    const reg = await request(app).post("/api/auth/register").send({
      email,
      name: "Auth User",
      role: "driver",
      driver: {
        licensePlate: "TEST-1234",
      },
      password: "longpassword1",
    });
    expect(reg.status).toBe(201);
    expect(reg.body.requiresVerification).toBe(true);

    await verifyDriverEmailForTests(app, email);

    const login = await request(app).post("/api/auth/login").send({
      email,
      password: "longpassword1",
    });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
    expect(login.body.user.email).toBe(email);

    const me = await request(app).get("/api/auth/me").set(authHeader(login.body.token));
    expect(me.status).toBe(200);
    expect(me.body._id).toBe(login.body.user._id);
  });

  test("protected route without token returns 401", async () => {
    const res = await request(app).get("/api/parking/spots/507f1f77bcf86cd799439011");
    expect(res.status).toBe(401);
  });
});
