const { AttendantLiveGridService } = require("./attendantLiveGrid.service");

const attendantLiveGridService = new AttendantLiveGridService();

const getLiveGrid = async (req, res, next) => {
  try {
    const data = await attendantLiveGridService.getLiveGridForAttendant({
      userId: req.user.userId,
    });
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
};

const instructLeave = async (req, res, next) => {
  try {
    const spotId = req.params.spotId;
    const data = await attendantLiveGridService.instructLeaveForSpot({
      userId: req.user.userId,
      spotId,
    });
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getLiveGrid,
  instructLeave,
};

