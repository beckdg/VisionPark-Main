const userRoutes = require("./user.routes");
const { UserService } = require("./user.service");
const { User, USER_ROLES } = require("./models/user.model");

module.exports = {
  userRoutes,
  UserService,
  User,
  USER_ROLES,
};
