const request = require("supertest");
const { registerAndLogin, authHeader } = require("./test-auth");

/**
 * Registers an owner, creates lot/zone/spot under that owner (with JWT).
 * Returns ids plus tokens/headers for owner.
 */
const seedOwnerInventory = async (app) => {
  const owner = await registerAndLogin(app, {
    email: `owner-${Date.now()}-${Math.random().toString(16).slice(2, 8)}@test.local`,
    name: "Test Owner",
    role: "owner",
  });
  const ownerH = authHeader(owner.token);

  const lotRes = await request(app).post("/api/parking/lots").set(ownerH).send({
    ownerId: owner.user._id,
    name: `lot-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    region: "Addis Ababa",
    city: "Addis Ababa",
    address: "Test Address",
  });
  expect(lotRes.status).toBe(201);

  const zoneRes = await request(app).post("/api/parking/zones").set(ownerH).send({
    lotId: lotRes.body._id,
    name: `zone-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    category: "car",
  });
  expect(zoneRes.status).toBe(201);

  const spotRes = await request(app).post("/api/parking/spots").set(ownerH).send({
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
    ownerToken: owner.token,
    ownerUser: owner.user,
    ownerHeader: ownerH,
  };
};

const seedDriver = async (app, label = "d") => {
  return registerAndLogin(app, {
    email: `${label}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}@test.local`,
    name: "Test Driver",
    role: "driver",
  });
};

const seedAttendant = async (app, label = "a") => {
  return registerAndLogin(app, {
    email: `${label}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}@test.local`,
    name: "Test Attendant",
    role: "attendant",
  });
};

const seedAdmin = async (app) => {
  return registerAndLogin(app, {
    email: `admin-${Date.now()}-${Math.random().toString(16).slice(2, 8)}@test.local`,
    name: "Test Admin",
    role: "admin",
  });
};

module.exports = {
  seedOwnerInventory,
  seedDriver,
  seedAttendant,
  seedAdmin,
  authHeader,
};
