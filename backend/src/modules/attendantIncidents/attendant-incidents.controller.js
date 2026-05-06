const { AttendantIncidentsService } = require("./attendant-incidents.service");

const service = new AttendantIncidentsService();

const listRecentIncidents = async (req, res, next) => {
  try {
    const data = await service.listRecent({
      userId: req.user.userId,
      limit: req.query?.limit,
    });
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
};

const createIncident = async (req, res, next) => {
  try {
    const data = await service.createIncident({
      userId: req.user.userId,
      payload: req.body,
    });
    return res.status(201).json(data);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listRecentIncidents,
  createIncident,
};

