const { FinanceService } = require("./finance.service");

const financeService = new FinanceService();

const getFilters = (req) => {
  return {
    region: req.query?.region ?? null,
    city: req.query?.city ?? null,
    branch: req.query?.branch ?? null,
    dateRange: req.query?.dateRange ?? null,
    range: req.query?.range ?? null,
  };
};

const getOwnerTransactions = async (req, res, next) => {
  try {
    const data = await financeService.getOwnerTransactions({
      ownerId: req.user.userId,
      filters: getFilters(req),
    });
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
};

const getOwnerRevenueTrend = async (req, res, next) => {
  try {
    const data = await financeService.getOwnerRevenueTrend({
      ownerId: req.user.userId,
      filters: getFilters(req),
    });
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getOwnerTransactions,
  getOwnerRevenueTrend,
};

