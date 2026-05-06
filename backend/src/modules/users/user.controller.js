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

const listMyAttendants = async (req, res, next) => {
  try {
    const attendants = await userService.listAttendantsByOwner(req.user);
    return res.status(200).json(attendants);
  } catch (error) {
    return next(error);
  }
};

const updateAttendant = async (req, res, next) => {
  try {
    const updated = await userService.updateAttendantByOwner(
      req.user,
      req.params.attendantId,
      req.body
    );
    return res.status(200).json(updated);
  } catch (error) {
    return next(error);
  }
};

const deleteAttendant = async (req, res, next) => {
  try {
    await userService.deleteAttendantByOwner(req.user, req.params.attendantId);
    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
};

const updateMyOwnerProfile = async (req, res, next) => {
  try {
    const updated = await userService.updateOwnerSelf(req.user, req.body);
    return res.status(200).json(updated);
  } catch (error) {
    return next(error);
  }
};

const updateMyDriverProfile = async (req, res, next) => {
  try {
    const updated = await userService.updateDriverSelf(req.user, req.body);
    return res.status(200).json(updated);
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
  listMyAttendants,
  updateAttendant,
  deleteAttendant,
  updateMyOwnerProfile,
  updateMyDriverProfile,
  getUserById,
};
