const request = require("supertest");
const { User } = require("../../src/modules/users/models/user.model");
const { hashPassword } = require("../../src/modules/auth/auth.utils");

const DEFAULT_PASSWORD = "testpassword12";
const DEFAULT_OWNER_ID = "507f1f77bcf86cd799439011";
const DEFAULT_LOT_ID = "507f1f77bcf86cd799439012";

const authHeader = (token) => ({
  Authorization: `Bearer ${token}`,
});

const aiApiKeyHeader = (key) => ({
  "x-api-key": key,
});

const withRoleDefaults = (payload = {}) => {
  const normalized = { ...payload };
  if (normalized.role === "driver" && !normalized.driver) {
    normalized.driver = { licensePlate: "TEST-1234" };
  }
  if (normalized.role === "owner" && !normalized.owner) {
    normalized.owner = { companyName: "Test Owner Co" };
  }
  if (normalized.role === "attendant" && !normalized.attendant) {
    normalized.attendant = {
      ownerId: DEFAULT_OWNER_ID,
      lotId: DEFAULT_LOT_ID,
    };
  }
  return normalized;
};

const registerUser = async (app, payload) => {
  const {
    email,
    name,
    role,
    password = DEFAULT_PASSWORD,
    driver,
    owner,
    attendant,
  } = withRoleDefaults(payload);
  const res = await request(app).post("/api/auth/register").send({
    email,
    name,
    role,
    password,
    driver,
    owner,
    attendant,
  });
  return { res, password, user: res.status === 201 ? res.body : null };
};

const loginUser = async (app, { email, password = DEFAULT_PASSWORD }) => {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res;
};

const registerAndLogin = async (app, payload) => {
  const normalized = withRoleDefaults(payload);
  const { email, password = DEFAULT_PASSWORD } = normalized;
  const reg = await registerUser(app, normalized);
  if (reg.res.status !== 201 && !(normalized.role === "admin" && reg.res.status === 403)) {
    throw new Error(`register failed: ${reg.res.status} ${JSON.stringify(reg.res.body)}`);
  }
  if (normalized.role === "admin" && reg.res.status === 403) {
    const normalizedEmail = String(email).trim().toLowerCase();
    const passwordHash = await hashPassword(password);
    await User.findOneAndUpdate(
      { email: normalizedEmail },
      {
        $set: {
          name: normalized.name,
          email: normalizedEmail,
          role: "admin",
          passwordHash,
          status: "active",
          driver: null,
          owner: null,
          attendant: null,
        },
      },
      { upsert: true }
    );
  }
  const res = await loginUser(app, { email, password });
  if (res.status !== 200) {
    throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return {
    token: res.body.token,
    user: res.body.user,
    password,
  };
};

module.exports = {
  DEFAULT_PASSWORD,
  authHeader,
  aiApiKeyHeader,
  registerUser,
  loginUser,
  registerAndLogin,
};
