const { PricingService } = require("./pricing.service");

const service = new PricingService();

const getVehicleCategories = async (_req, res, next) => {
  try {
    return res.status(200).json(service.getVehicleCategories());
  } catch (e) {
    return next(e);
  }
};

const getConfig = async (req, res, next) => {
  try {
    const data = await service.getConfig(req.user, req.query.lotId);
    return res.status(200).json(data);
  } catch (e) {
    return next(e);
  }
};

const putConfig = async (req, res, next) => {
  try {
    const data = await service.upsertConfig(req.user, req.query.lotId, req.body || {});
    return res.status(200).json(data);
  } catch (e) {
    return next(e);
  }
};

module.exports = {
  getVehicleCategories,
  getConfig,
  putConfig,
};
