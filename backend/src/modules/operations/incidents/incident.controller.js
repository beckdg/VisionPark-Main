const { IncidentService } = require("./incident.service");

const incidentService = new IncidentService();

const createIncident = async (req, res, next) => {
  try {
    const incident = await incidentService.createIncident({
      createdByType: req.body.createdByType,
      createdById: req.body.createdById,
      type: req.body.type,
      severity: req.body.severity,
      description: req.body.description,
      sessionId: req.body.sessionId,
      spotId: req.body.spotId,
      plate: req.body.plate,
      evidence: req.body.evidence,
      tags: req.body.tags,
    });
    return res.status(201).json(incident);
  } catch (error) {
    return next(error);
  }
};

const transitionIncidentStatus = async (req, res, next) => {
  try {
    const incident = await incidentService.transitionStatus({
      incidentId: req.params.incidentId,
      toStatus: req.body.toStatus,
    });
    return res.status(200).json(incident);
  } catch (error) {
    return next(error);
  }
};

const getIncidentById = async (req, res, next) => {
  try {
    const incident = await incidentService.getById(req.params.incidentId);
    return res.status(200).json(incident);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createIncident,
  transitionIncidentStatus,
  getIncidentById,
};
