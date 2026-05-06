const { AttendantWalkupService } = require("./attendantWalkup.service");

const attendantWalkupService = new AttendantWalkupService();

const createWalkupCheckin = async (req, res, next) => {
  try {
    const data = await attendantWalkupService.createWalkupCheckin({
      userId: req.user.userId,
      payload: req.body,
    });
    return res.status(201).json(data);
  } catch (error) {
    return next(error);
  }
};

const getRecentWalkupCheckins = async (req, res, next) => {
  try {
    const data = await attendantWalkupService.listRecentCheckins({
      userId: req.user.userId,
      limit: req.query.limit,
    });
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
};

const getWalkupReceipt = async (req, res, next) => {
  try {
    const data = await attendantWalkupService.getReceipt({
      userId: req.user.userId,
      checkinId: req.params.checkinId,
    });
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createWalkupCheckin,
  getRecentWalkupCheckins,
  getWalkupReceipt,
};

