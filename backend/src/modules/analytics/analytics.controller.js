const { AnalyticsService } = require("./analytics.service");

const analyticsService = new AnalyticsService();

const getScopeFromQuery = (req) => {
  return {
    region: req.query?.region ?? null,
    city: req.query?.city ?? null,
    branch: req.query?.branch ?? null,
  };
};

const getOwnerDashboard = async (req, res, next) => {
  try {
    const data = await analyticsService.getOwnerDashboard({
      ownerId: req.user.userId,
      scope: getScopeFromQuery(req),
    });
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
};

const getOwnerOccupancy = async (req, res, next) => {
  try {
    const data = await analyticsService.getOwnerOccupancy({
      ownerId: req.user.userId,
      scope: getScopeFromQuery(req),
    });
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
};

const getOwnerRevenue = async (req, res, next) => {
  try {
    const range = String(req.query?.range ?? "today");
    const data = await analyticsService.getOwnerRevenueByHour({
      ownerId: req.user.userId,
      scope: getScopeFromQuery(req),
      range,
    });
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
};

const getOwnerRecentActivity = async (req, res, next) => {
  try {
    const data = await analyticsService.getOwnerRecentActivity({
      ownerId: req.user.userId,
      scope: getScopeFromQuery(req),
    });
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getOwnerDashboard,
  getOwnerOccupancy,
  getOwnerRevenue,
  getOwnerRecentActivity,
};

