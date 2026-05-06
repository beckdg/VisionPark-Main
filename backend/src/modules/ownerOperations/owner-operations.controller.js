const { OwnerOperationsService } = require("./owner-operations.service");

const service = new OwnerOperationsService();

const getOwnerIncidents = async (req, res, next) => {
  try {
    const data = await service.getOwnerIncidents({ ownerId: req.user.userId });
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
};

const updateOwnerIncidentStatus = async (req, res, next) => {
  try {
    const data = await service.updateOwnerIncidentStatus({
      ownerId: req.user.userId,
      incidentId: req.params.incidentId,
      status: req.body?.status,
    });
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getOwnerIncidents,
  updateOwnerIncidentStatus,
};

