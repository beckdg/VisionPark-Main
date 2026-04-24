const { AuthService } = require("./auth.service");

const authService = new AuthService();

const register = async (req, res, next) => {
  try {
    const user = await authService.registerUser(req.body);
    return res.status(201).json(user);
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const { token, user } = await authService.loginUser(email, password);
    return res.status(200).json({ token, user });
  } catch (error) {
    return next(error);
  }
};

const me = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user.userId);
    return res.status(200).json(user);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  register,
  login,
  me,
};
