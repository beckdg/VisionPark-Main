const request = require("supertest");
const mongoose = require("mongoose");
const { createApp } = require("../../src/app");
const { authHeader } = require("../utils/test-auth");
const { seedAdmin, seedOwnerInventory } = require("../utils/inventory-with-auth");

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

describe("Provisioned owner / attendant first-login password", () => {
  test("admin-created owner must change password before using the app", async () => {
    const email = `owner-provision-${Date.now()}@test.local`;
    const tempPassword = "TempPass!123";
    const newPassword = "NewSecure!456";

    const admin = await seedAdmin(app);

    const createOwner = await request(app)
      .post("/api/users/owners")
      .set(authHeader(admin.token))
      .send({
        name: "Provisioned Owner",
        email,
        password: tempPassword,
        owner: { companyName: "Test Co", phone: "+251911111111" },
      });
    expect(createOwner.status).toBe(201);
    expect(createOwner.body.mustChangePassword).toBe(true);

    const loginTemp = await request(app).post("/api/auth/login").send({
      email,
      password: tempPassword,
    });
    expect(loginTemp.status).toBe(200);
    expect(loginTemp.body.requiresPasswordChange).toBe(true);
    expect(loginTemp.body.user.mustChangePassword).toBe(true);

    const meAllowed = await request(app)
      .get("/api/auth/me")
      .set(authHeader(loginTemp.body.token));
    expect(meAllowed.status).toBe(200);
    expect(meAllowed.body.mustChangePassword).toBe(true);

    const blocked = await request(app)
      .patch("/api/users/owners/me")
      .set(authHeader(loginTemp.body.token))
      .send({ owner: { companyName: "Updated Co" } });
    expect(blocked.status).toBe(403);

    const setup = await request(app)
      .post("/api/auth/complete-initial-password")
      .set(authHeader(loginTemp.body.token))
      .send({
        currentPassword: tempPassword,
        newPassword,
      });
    expect(setup.status).toBe(200);
    expect(setup.body.data.user.mustChangePassword).toBe(false);

    const loginNew = await request(app).post("/api/auth/login").send({
      email,
      password: newPassword,
    });
    expect(loginNew.status).toBe(200);
    expect(loginNew.body.requiresPasswordChange).toBe(false);

    const ownerProfile = await request(app)
      .patch("/api/users/owners/me")
      .set(authHeader(loginNew.body.token))
      .send({ owner: { companyName: "Updated Co" } });
    expect(ownerProfile.status).toBe(200);
  });

  test("owner-created attendant must change password before using the app", async () => {
    const email = `attendant-provision-${Date.now()}@test.local`;
    const tempPassword = "TempPass!123";
    const newPassword = "NewSecure!456";

    const inventory = await seedOwnerInventory(app);

    const createAttendant = await request(app)
      .post("/api/users/attendants")
      .set(authHeader(inventory.ownerToken))
      .send({
        name: "Provisioned Attendant",
        email,
        password: tempPassword,
        attendant: { lotId: inventory.lotId },
      });
    expect(createAttendant.status).toBe(201);
    expect(createAttendant.body.mustChangePassword).toBe(true);

    const loginTemp = await request(app).post("/api/auth/login").send({
      email,
      password: tempPassword,
    });
    expect(loginTemp.status).toBe(200);
    expect(loginTemp.body.requiresPasswordChange).toBe(true);

    const blocked = await request(app)
      .get("/api/users/attendants")
      .set(authHeader(loginTemp.body.token));
    expect(blocked.status).toBe(403);

    const setup = await request(app)
      .post("/api/auth/complete-initial-password")
      .set(authHeader(loginTemp.body.token))
      .send({
        currentPassword: tempPassword,
        newPassword,
      });
    expect(setup.status).toBe(200);

    const loginNew = await request(app).post("/api/auth/login").send({
      email,
      password: newPassword,
    });
    expect(loginNew.status).toBe(200);
    expect(loginNew.body.requiresPasswordChange).toBe(false);
  });
});
