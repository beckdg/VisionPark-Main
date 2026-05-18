const { AuthService } = require("./auth.service");

const authService = new AuthService();

const register = async (req, res, next) => {
  try {
    const result = await authService.registerUser(req.body);
    if (result.requiresVerification) {
      return res.status(201).json({
        success: true,
        requiresVerification: true,
        email: result.email,
        message: "A verification code has been sent to your email.",
      });
    }
    return res.status(201).json(result.user);
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
