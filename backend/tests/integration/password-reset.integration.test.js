const request = require("supertest");
const mongoose = require("mongoose");
const { createApp } = require("../../src/app");
const { User } = require("../../src/modules/users/models/user.model");
const { EmailVerification } = require("../../src/modules/emailVerification/models/email-verification.model");
const { generateOtpCode, hashOtp } = require("../../src/modules/emailVerification/otp.utils");
const { hashPassword, comparePassword } = require("../../src/modules/auth/auth.utils");
const { verifyDriverEmailForTests } = require("../utils/test-auth");

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

const seedUser = async ({ email, role, password }) => {
  const passwordHash = await hashPassword(password);
  return User.create({
    name: `${role} User`,
    email,
    role,
    passwordHash,
    status: "active",
    emailVerified: role === "driver" ? false : true,
    emailVerifiedAt: role === "driver" ? null : new Date(),
    driver: role === "driver" ? { licensePlate: "RESET-001" } : null,
    owner: role === "owner" ? { companyName: "Reset Co" } : null,
    attendant:
      role === "attendant"
        ? {
            ownerId: new mongoose.Types.ObjectId(),
            lotId: new mongoose.Types.ObjectId(),
          }
        : null,
  });
};

const seedPasswordResetOtp = async (user) => {
  const otpCode = generateOtpCode();
  const otpHash = await hashOtp(otpCode);
  await EmailVerification.create({
    userId: user._id,
    email: user.email,
    otpHash,
    purpose: "password_reset",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    attempts: 0,
    maxAttempts: 5,
    verified: false,
  });
  return otpCode;
};

describe("Password reset API", () => {
  test.each([
    ["driver", "driver-reset@test.local"],
    ["owner", "owner-reset@test.local"],
    ["attendant", "attendant-reset@test.local"],
    ["admin", "admin-reset@test.local"],
  ])("full reset flow works for %s role", async (role, email) => {
    const oldPassword = "oldpassword1";
    const newPassword = "NewPass!234";

    await seedUser({ email, role, password: oldPassword });
    if (role === "driver") {
      await verifyDriverEmailForTests(app, email);
    }

    const forgot = await request(app).post("/api/auth/forgot-password").send({ email });
    expect(forgot.status).toBe(200);
    expect(forgot.body.success).toBe(true);

    const otpCode = await seedPasswordResetOtp(await User.findOne({ email }));

    const verify = await request(app)
      .post("/api/auth/verify-password-reset-otp")
      .send({ email, otp: otpCode });
    expect(verify.status).toBe(200);
    expect(verify.body.data.resetToken).toBeTruthy();

    const reset = await request(app)
      .post("/api/auth/reset-password")
      .send({ resetToken: verify.body.data.resetToken, password: newPassword });
    expect(reset.status).toBe(200);
    expect(reset.body.success).toBe(true);

    const user = await User.findOne({ email }).select("+passwordHash");
    const matches = await comparePassword(newPassword, user.passwordHash);
    expect(matches).toBe(true);
    expect(user.passwordChangedAt).toBeTruthy();

    const loginOld = await request(app).post("/api/auth/login").send({
      email,
      password: oldPassword,
    });
    expect(loginOld.status).toBe(401);

    const loginNew = await request(app).post("/api/auth/login").send({
      email,
      password: newPassword,
    });
    expect(loginNew.status).toBe(200);
  });

  test("forgot-password does not reveal unknown email", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "unknown-user@test.local" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/if an account exists/i);
  });
});
