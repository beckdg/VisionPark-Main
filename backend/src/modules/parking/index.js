const parkingRoutes = require("./parking.routes");
const { ParkingService, ParkingError } = require("./parking.service");
const { ParkingLot } = require("./models/parking-lot.model");
const { ParkingZone } = require("./models/parking-zone.model");
const { ParkingSpot, SPOT_STATES } = require("./models/parking-spot.model");

module.exports = {
  parkingRoutes,
  ParkingService,
  ParkingError,
  ParkingLot,
  ParkingZone,
  ParkingSpot,
  SPOT_STATES,
};
