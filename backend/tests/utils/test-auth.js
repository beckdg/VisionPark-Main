const request = require("supertest");

const DEFAULT_PASSWORD = "testpassword12";

const authHeader = (token) => ({
  Authorization: `Bearer ${token}`,
});

const aiApiKeyHeader = (key) => ({
  "x-api-key": key,
});

const registerUser = async (app, { email, name, role, password = DEFAULT_PASSWORD }) => {
  const res = await request(app).post("/api/auth/register").send({
    email,
    name,
    role,
    password,
  });
  return { res, password, user: res.status === 201 ? res.body : null };
};

const loginUser = async (app, { email, password = DEFAULT_PASSWORD }) => {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res;
};

const registerAndLogin = async (app, { email, name, role, password = DEFAULT_PASSWORD }) => {
  const reg = await registerUser(app, { email, name, role, password });
  if (reg.res.status !== 201) {
    throw new Error(`register failed: ${reg.res.status} ${JSON.stringify(reg.res.body)}`);
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
