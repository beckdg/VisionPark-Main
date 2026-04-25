const { UserService } = require("./user.service");

const userService = new UserService();

const createUser = async (req, res, next) => {
  try {
    const user = await userService.createUser(req.body);
    return res.status(201).json(user);
  } catch (error) {
    return next(error);
  }
};

const createOwner = async (req, res, next) => {
  try {
    const user = await userService.createOwnerByAdmin(req.user, req.body);
    return res.status(201).json(user);
  } catch (error) {
    return next(error);
  }
};

const createAttendant = async (req, res, next) => {
  try {
    const user = await userService.createAttendantByOwner(req.user, req.body);
    return res.status(201).json(user);
  } catch (error) {
    return next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id);
    return res.status(200).json(user);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createUser,
  createOwner,
  createAttendant,
  getUserById,
};
