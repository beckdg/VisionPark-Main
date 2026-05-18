const { OwnerAttendantsService } = require("./ownerAttendants.service");

const ownerAttendantsService = new OwnerAttendantsService();

const listBranches = async (req, res, next) => {
  try {
    const data = await ownerAttendantsService.listBranches({
      ownerUserId: req.user.userId,
    });
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
};

const listAttendants = async (req, res, next) => {
  try {
    const data = await ownerAttendantsService.listAttendants({
      ownerUserId: req.user.userId,
      branchId: req.query.branchId,
    });
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
};

const getAttendantDetails = async (req, res, next) => {
  try {
    const data = await ownerAttendantsService.getAttendantDetails({
      ownerUserId: req.user.userId,
      attendantId: req.params.attendantId,
    });
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
};

const getShiftReport = async (req, res, next) => {
  try {
    const data = await ownerAttendantsService.getShiftReport({
      ownerUserId: req.user.userId,
      reportId: req.params.reportId,
    });
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listBranches,
  listAttendants,
  getAttendantDetails,
  getShiftReport,
};
