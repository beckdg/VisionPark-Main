const { ParkingSpot } = require("../parking/models/parking-spot.model");
const { ParkingLot } = require("../parking/models/parking-lot.model");
const { ParkingSession } = require("../sessions/models/parking-session.model");
const { User } = require("../users/models/user.model");
const { Incident } = require("../operations/models/incident.model");
const { AttendantLiveGridLeaveInstruction } = require("./models/attendant-spot-leave-instruction.model");
const { NotFoundError, ValidationError } = require("../../common/errors");

const computeEta = (expiresAt) => {
  if (!expiresAt) return null;
  const nowMs = Date.now();
  const expMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expMs) || expMs <= nowMs) return null;

  const totalMinutes = Math.ceil((expMs - nowMs) / 60000);
  if (totalMinutes <= 0) return null;
  return totalMinutes === 1 ? "1 min" : `${totalMinutes} mins`;
};

const toIsoOrNull = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.valueOf())) return null;
  return d.toISOString();
};

class AttendantLiveGridService {
  async getLiveGridForAttendant({ userId }) {
    const attendant = await User.findById(userId)
      .select("role attendant.lotId")
      .lean();

    if (!attendant) throw new NotFoundError("User not found.");
    if (attendant.role !== "attendant") {
      // Admin can be authorized on the route, but this endpoint is branch-scoped via attendant.lotId.
      throw new ValidationError("Only attendants may query live grid.");
    }

    const lotId = attendant?.attendant?.lotId;
    if (!lotId) throw new ValidationError("Attendant.lotId is required for live grid scoping.");
    const lot = await ParkingLot.findById(lotId).select("name").lean();
    const branchName = lot?.name ?? null;

    const spots = await ParkingSpot.find({ lotId })
      .sort({ spotCode: 1 })
      .select("lotId spotCode allowedCategories status isBlocked derivationVersion derivedFromSessionId")
      .lean();

    if (!spots.length) return [];

    const spotIdList = spots.map((s) => s._id);

    // Active sessions represent reserved/occupied states.
    const sessions = await ParkingSession.find({
      spotId: { $in: spotIdList },
      state: { $in: ["reserved", "secured"] },
    })
      .populate({
        path: "driverId",
        select: "name driver.licensePlate driver.phone driver.vehicleType",
      })
      .sort({ updatedAt: -1 })
      .lean();

    const sessionBySpotId = new Map();
    for (const s of sessions) {
      // Unique index should guarantee 1 active session per spot.
      sessionBySpotId.set(String(s.spotId), s);
    }

    // AI mismatch incidents help flag conflicts (unauthorized plate in reserved/occupied spot).
    const mismatchIncidents = await Incident.find({
      spotId: { $in: spotIdList },
      type: "AI_MISMATCH_DETECTED",
      plate: { $exists: true },
    })
      .sort({ createdAt: -1 })
      .select("spotId sessionId plate createdAt type")
      .lean();

    const incidentsBySpotId = new Map();
    for (const inc of mismatchIncidents) {
      const key = String(inc.spotId);
      const arr = incidentsBySpotId.get(key) ?? [];
      arr.push(inc);
      incidentsBySpotId.set(key, arr);
    }

    // Persisted "instruct to leave" intent.
    const instructions = await AttendantLiveGridLeaveInstruction.find({
      attendantId: userId,
      spotId: { $in: spotIdList },
      waitingToMove: true,
    })
      .select("spotId waitingToMove")
      .lean();

    const instructionBySpotId = new Map();
    for (const i of instructions) {
      instructionBySpotId.set(String(i.spotId), i);
    }

    const computed = spots.map((spot) => {
      const spotIdStr = String(spot._id);
      const session = sessionBySpotId.get(spotIdStr) ?? null;

      const expectedDriverUser = session?.driverId ?? null;
      const expectedPlate = expectedDriverUser?.driver?.licensePlate ?? null;
      const expectedPhone = expectedDriverUser?.driver?.phone ?? null;
      const expectedDriverName = expectedDriverUser?.name ?? null;

      // Occupancy plate (if conflict) is derived from latest mismatch incident.
      const incidents = incidentsBySpotId.get(spotIdStr) ?? [];
      const sessionEntryAt = session?.state === "secured" ? session?.securedAt : session?.reservedAt;

      const latestRelevantIncident =
        incidents.find((inc) => {
          if (!sessionEntryAt) return true;
          const incMs = new Date(inc.createdAt).getTime();
          const sessMs = new Date(sessionEntryAt).getTime();
          return !Number.isNaN(incMs) && !Number.isNaN(sessMs) && incMs >= sessMs;
        }) ?? null;

      const actualPlate = latestRelevantIncident?.plate ?? null;

      const isBlockedConflict = Boolean(spot?.isBlocked) || spot?.status === "blocked";
      const plateMismatchConflict =
        Boolean(session) && Boolean(actualPlate) && Boolean(expectedPlate) && String(actualPlate) !== String(expectedPlate);

      const isConflict = isBlockedConflict || plateMismatchConflict;

      let status = "free";
      if (session) {
        status = session.state === "reserved" ? "reserved" : "occupied";
      }
      if (isConflict) status = "conflict";

      const etaStr = computeEta(session?.expiresAt);

      const reservation =
        session
          ? {
              driverName: expectedDriverName,
              plateNumber: expectedPlate,
              eta: session?.state === "reserved" || isConflict ? etaStr : null,
              phone: expectedPhone,
            }
          : null;

      const occupancy =
        session?.state === "secured"
          ? {
              plateNumber: actualPlate ?? expectedPlate,
              entryTime: toIsoOrNull(session?.securedAt) ?? toIsoOrNull(session?.reservedAt),
              sessionId: String(session?._id),
            }
          : null;

      const hasInstruction = Boolean(instructionBySpotId.get(spotIdStr));
      const waitingToMove = hasInstruction && status !== "free";

      return {
        id: spot.spotCode,
        branchName,
        status,
        category: spot.allowedCategories?.[0] ?? null,
        reservation,
        occupancy,
        isConflict,
        waitingToMove,
      };
    });

    // Auto-clear instruct-to-leave records when the spot returns to free state.
    const mongoIdBySpotCode = new Map(spots.map((s) => [s.spotCode, s._id]));
    const freeSpotMongoIdsWithInstruction = computed
      .filter((s) => s.status === "free")
      .map((s) => mongoIdBySpotCode.get(s.id))
      .filter((mongoId) => mongoId && instructionBySpotId.has(String(mongoId)));

    if (freeSpotMongoIdsWithInstruction.length) {
      await AttendantLiveGridLeaveInstruction.deleteMany({
        attendantId: userId,
        spotId: { $in: freeSpotMongoIdsWithInstruction },
      });
    }

    // Ensure the computed order matches the spot list order for stable UX.
    const byId = new Map(computed.map((c) => [c.id, c]));
    return spots.map((spot) => byId.get(spot.spotCode)).filter(Boolean);
  }

  async instructLeaveForSpot({ userId, spotId }) {
    if (!spotId) throw new ValidationError("spotId is required.");

    const attendant = await User.findById(userId)
      .select("role attendant.lotId")
      .lean();

    if (!attendant) throw new NotFoundError("User not found.");
    if (attendant.role !== "attendant") {
      throw new ValidationError("Only attendants may instruct leave.");
    }

    const lotId = attendant?.attendant?.lotId;
    if (!lotId) throw new ValidationError("Attendant.lotId is required for instruct-leave scoping.");

    // Frontend sends spot.id (spotCode like "A01").
    const spot = await ParkingSpot.findOne({ lotId, spotCode: String(spotId) })
      .select("_id spotCode isBlocked status")
      .lean();

    if (!spot) throw new NotFoundError("Spot not found for your assigned branch.");

    await AttendantLiveGridLeaveInstruction.findOneAndUpdate(
      {
        attendantId: userId,
        spotId: spot._id,
      },
      {
        $set: {
          lotId,
          spotCode: spot.spotCode,
          waitingToMove: true,
          clearedAt: null,
        },
      },
      { upsert: true, new: true }
    );

    // Optional audit trail (doesn't affect sessions).
    // We keep this minimal to avoid coupling to other modules.
    const session = await ParkingSession.findOne({
      spotId: spot._id,
      state: { $in: ["reserved", "secured"] },
    })
      .populate({ path: "driverId", select: "name driver.licensePlate driver.phone" })
      .lean();

    const plate = session?.driverId?.driver?.licensePlate ?? null;
    const driverName = session?.driverId?.name ?? null;

    await Incident.create({
      createdByType: "attendant",
      createdById: userId,
      type: "ATTENDANT_INSTRUCT_LEAVE",
      severity: "low",
      description: `Attendant instructed driver/vehicle to leave for spot ${spot.spotCode}. Expected driver: ${driverName ?? "unknown"}.`,
      sessionId: session?._id ?? null,
      spotId: spot._id,
      plate,
      tags: ["attendant", "live_grid", "instruct_leave"],
    });

    return {
      spotId: spot.spotCode,
      waitingToMove: true,
    };
  }
}

module.exports = {
  AttendantLiveGridService,
};

