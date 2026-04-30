const { ParkingService } = require("./parking.service");

const parkingService = new ParkingService();

const listLots = async (req, res, next) => {
  try {
    const lots = await parkingService.listLots({
      role: req.user.role,
      userId: req.user.userId,
    });
    return res.status(200).json(lots);
  } catch (error) {
    return next(error);
  }
};

const listPublicLots = async (req, res, next) => {
  try {
    const lots = await parkingService.listPublicLots();
    return res.status(200).json(lots);
  } catch (error) {
    return next(error);
  }
};

const listZones = async (req, res, next) => {
  try {
    const zones = await parkingService.listZones({
      role: req.user.role,
      userId: req.user.userId,
      lotId: req.query.lotId,
    });
    return res.status(200).json(zones);
  } catch (error) {
    return next(error);
  }
};

const listSpots = async (req, res, next) => {
  try {
    const spots = await parkingService.listSpots({
      role: req.user.role,
      userId: req.user.userId,
      zoneId: req.query.zoneId,
    });
    return res.status(200).json(spots);
  } catch (error) {
    return next(error);
  }
};

const createLot = async (req, res, next) => {
  try {
    const ownerIdFromToken = req.user?.role === "owner" ? req.user.userId : req.body.ownerId;
    const lot = await parkingService.createLot({
      ownerId: ownerIdFromToken,
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

const updateLot = async (req, res, next) => {
  try {
    const lot = await parkingService.updateLot({
      role: req.user.role,
      userId: req.user.userId,
      lotId: req.params.lotId,
      payload: req.body,
    });
    return res.status(200).json(lot);
  } catch (error) {
    return next(error);
  }
};

const deleteLot = async (req, res, next) => {
  try {
    const result = await parkingService.deleteLot({
      role: req.user.role,
      userId: req.user.userId,
      lotId: req.params.lotId,
    });
    return res.status(200).json(result);
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
      paymentRate: req.body.paymentRate,
      isActive: req.body.isActive,
    });
    return res.status(201).json(zone);
  } catch (error) {
    return next(error);
  }
};

const updateZone = async (req, res, next) => {
  try {
    const zone = await parkingService.updateZone({
      role: req.user.role,
      userId: req.user.userId,
      zoneId: req.params.zoneId,
      payload: req.body,
    });
    return res.status(200).json(zone);
  } catch (error) {
    return next(error);
  }
};

const deleteZone = async (req, res, next) => {
  try {
    const result = await parkingService.deleteZone({
      role: req.user.role,
      userId: req.user.userId,
      zoneId: req.params.zoneId,
    });
    return res.status(200).json(result);
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

const updateSpot = async (req, res, next) => {
  try {
    const spot = await parkingService.updateSpot({
      role: req.user.role,
      userId: req.user.userId,
      spotId: req.params.spotId,
      payload: req.body,
    });
    return res.status(200).json(spot);
  } catch (error) {
    return next(error);
  }
};

const deleteSpot = async (req, res, next) => {
  try {
    const result = await parkingService.deleteSpot({
      role: req.user.role,
      userId: req.user.userId,
      spotId: req.params.spotId,
    });
    return res.status(200).json(result);
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
  listPublicLots,
  listLots,
  listZones,
  listSpots,
  createLot,
  updateLot,
  deleteLot,
  createZone,
  updateZone,
  deleteZone,
  createSpot,
  updateSpot,
  deleteSpot,
  setSpotBlocked,
  getSpotById,
  deriveSpotStatus,
};
