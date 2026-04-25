const { ParkingService } = require("./parking.service");

const parkingService = new ParkingService();

const createLot = async (req, res, next) => {
  try {
    const lot = await parkingService.createLot({
      ownerId: req.body.ownerId,
      name: req.body.name,
      region: req.body.region,
      city: req.body.city,
      address: req.body.address,
      location: req.body.location,
      status: req.body.status,
      isActive: req.body.isActive,
      overstayMultiplier: req.body.overstayMultiplier,
    });
    return res.status(201).json(lot);
  } catch (error) {
    return next(error);
  }
};

const createZone = async (req, res, next) => {
  try {
    const zone = await parkingService.createZone({
      lotId: req.body.lotId,
      name: req.body.name,
      category: req.body.category,
      allowedCategories: req.body.allowedCategories,
      isActive: req.body.isActive,
    });
    return res.status(201).json(zone);
  } catch (error) {
    return next(error);
  }
};

const createSpot = async (req, res, next) => {
  try {
    const spot = await parkingService.createSpot({
      lotId: req.body.lotId,
      zoneId: req.body.zoneId,
      spotCode: req.body.spotCode,
      code: req.body.code,
      category: req.body.category,
      allowedCategories: req.body.allowedCategories,
    });
    return res.status(201).json(spot);
  } catch (error) {
    return next(error);
  }
};

const setSpotBlocked = async (req, res, next) => {
  try {
    const updated = await parkingService.setSpotBlocked(
      req.params.spotId,
      req.body.isBlocked
    );
    return res.status(200).json(updated);
  } catch (error) {
    return next(error);
  }
};

const getSpotById = async (req, res, next) => {
  try {
    const spot = await parkingService.getSpotById(req.params.spotId);
    return res.status(200).json(spot);
  } catch (error) {
    return next(error);
  }
};

const deriveSpotStatus = async (req, res, next) => {
  try {
    const spot = await parkingService.updateSpotStatus(req.params.spotId);
    return res.status(200).json(spot);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createLot,
  createZone,
  createSpot,
  setSpotBlocked,
  getSpotById,
  deriveSpotStatus,
};
