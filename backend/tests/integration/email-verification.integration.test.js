const request = require("supertest");
const mongoose = require("mongoose");
const { createApp } = require("../../src/app");
const { User } = require("../../src/modules/users/models/user.model");
const { EmailVerification } = require("../../src/modules/emailVerification/models/email-verification.model");
const { authHeader } = require("../utils/test-auth");
const { generateOtpCode, hashOtp } = require("../../src/modules/emailVerification/otp.utils");

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

describe("Driver email verification", () => {
  test("driver register requires verification and blocks login until OTP verified", async () => {
    const email = `driver-${Date.now()}@test.local`;
    const password = "longpassword1";

    const reg = await request(app).post("/api/auth/register").send({
      email,
      name: "Driver User",
      role: "driver",
      password,
      driver: { licensePlate: "TEST-9999" },
    });

    expect(reg.status).toBe(201);
    expect(reg.body.requiresVerification).toBe(true);
    expect(reg.body.email).toBe(email);

    const user = await User.findOne({ email });
    expect(user.emailVerified).toBe(false);

    const loginBlocked = await request(app).post("/api/auth/login").send({ email, password });
    expect(loginBlocked.status).toBe(401);
    expect(loginBlocked.body.error.message).toMatch(/verify your email/i);

    const otpCode = generateOtpCode();
    const otpHash = await hashOtp(otpCode);
    await EmailVerification.create({
      userId: user._id,
      email,
      otpHash,
      purpose: "signup",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      attempts: 0,
      maxAttempts: 5,
      verified: false,
    });

    const verify = await request(app)
      .post("/api/auth/verify-email-otp")
      .send({ email, otp: otpCode });

    expect(verify.status).toBe(200);
    expect(verify.body.success).toBe(true);
    expect(verify.body.data.token).toBeTruthy();
    expect(verify.body.data.user.emailVerified).toBe(true);

    const login = await request(app).post("/api/auth/login").send({ email, password });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();

    const me = await request(app).get("/api/auth/me").set(authHeader(login.body.token));
    expect(me.status).toBe(200);
  });

  test("unverified driver cannot access protected routes with token from verify flow only after verify", async () => {
    const email = `driver2-${Date.now()}@test.local`;
    const password = "longpassword1";

    await request(app).post("/api/auth/register").send({
      email,
      name: "Driver Two",
      role: "driver",
      password,
      driver: { licensePlate: "TEST-8888" },
    });

    const fakeToken = require("jsonwebtoken").sign(
      { userId: String((await User.findOne({ email }))._id), role: "driver" },
      process.env.JWT_SECRET || "test-jwt-secret-visionpark",
      { expiresIn: "1h" }
    );

    const protectedRes = await request(app)
      .get("/api/auth/me")
      .set(authHeader(fakeToken));
    expect(protectedRes.status).toBe(403);
  });
});
