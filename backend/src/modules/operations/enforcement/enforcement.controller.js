const { EnforcementService, EnforcementError } = require("./enforcement.service");
const { ValidationError } = require("../../../common/errors");

const enforcementService = new EnforcementService();

const createEnforcement = async (req, res, next) => {
  try {
    const enforcement = await enforcementService.createEnforcement(req.body);
    return res.status(201).json(enforcement);
  } catch (error) {
    return next(error);
  }
};

const transitionEnforcement = async (req, res, next) => {
  try {
    const { action } = req.body;
    let enforcement;
    if (action === "flag") enforcement = await enforcementService.flagEnforcement(req.params.enforcementId);
    else if (action === "clamp") enforcement = await enforcementService.clampEnforcement(req.params.enforcementId);
    else if (action === "clear") enforcement = await enforcementService.clearEnforcement(req.params.enforcementId);
    else throw new ValidationError("action must be flag, clamp, or clear.");

    return res.status(200).json(enforcement);
  } catch (error) {
    return next(error);
  }
};

const applySpotBlock = async (req, res, next) => {
  try {
    const result = await enforcementService.applySpotBlock({
      enforcementId: req.params.enforcementId,
      spotId: req.body.spotId,
    });
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const removeSpotBlock = async (req, res, next) => {
  try {
    const result = await enforcementService.removeSpotBlock({
      enforcementId: req.params.enforcementId,
      spotId: req.body.spotId,
    });
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const getEnforcementById = async (req, res, next) => {
  try {
    const enforcement = await enforcementService.getById(req.params.enforcementId);
    return res.status(200).json(enforcement);
  } catch (error) {
    return next(error);
  }
};

const clearEnforcementPost = async (req, res, next) => {
  try {
    const enforcement = await enforcementService.clearEnforcement(req.params.enforcementId);
    return res.status(200).json(enforcement);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createEnforcement,
  clearEnforcementPost,
  transitionEnforcement,
  applySpotBlock,
  removeSpotBlock,
  getEnforcementById,
};
