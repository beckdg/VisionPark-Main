const authRoutes = require("./auth.routes");
const { AuthService } = require("./auth.service");
const authMiddleware = require("./auth.middleware");

module.exports = {
  authRoutes,
  AuthService,
  ...authMiddleware,
};
