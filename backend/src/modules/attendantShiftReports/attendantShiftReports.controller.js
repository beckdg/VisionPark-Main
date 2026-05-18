const { AttendantShiftReportsService } = require("./attendantShiftReports.service");

const attendantShiftReportsService = new AttendantShiftReportsService();

const startShift = async (req, res, next) => {
  try {
    const data = await attendantShiftReportsService.startShift({
      userId: req.user.userId,
    });
    return res.status(201).json(data);
  } catch (error) {
    return next(error);
  }
};

const getCurrentZReport = async (req, res, next) => {
  try {
    const data = await attendantShiftReportsService.getCurrentZReport({
      userId: req.user.userId,
    });
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
};

const closeShift = async (req, res, next) => {
  try {
    const data = await attendantShiftReportsService.closeShift({
      userId: req.user.userId,
      cashInHand: req.body?.cashInHand,
    });
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  startShift,
  getCurrentZReport,
  closeShift,
};
