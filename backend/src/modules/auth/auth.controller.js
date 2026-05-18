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
    const { token, user, requiresPasswordChange } = await authService.loginUser(
      email,
      password
    );
    return res.status(200).json({ token, user, requiresPasswordChange: Boolean(requiresPasswordChange) });
  } catch (error) {
    return next(error);
  }
};

const completeInitialPassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const result = await authService.completeInitialPassword(
      req.user.userId,
      currentPassword,
      newPassword
    );
    return res.status(200).json({
      success: true,
      data: {
        token: result.token,
        user: result.user,
        requiresPasswordChange: false,
      },
    });
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
  completeInitialPassword,
};
