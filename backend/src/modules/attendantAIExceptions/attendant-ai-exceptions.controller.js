const { AttendantAIExceptionsService } = require("./attendant-ai-exceptions.service");

const service = new AttendantAIExceptionsService();

const listAIExceptions = async (req, res, next) => {
  try {
    const data = await service.listForAttendant({
      userId: req.user.userId,
      query: req.query,
    });
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
};

const getAIExceptionById = async (req, res, next) => {
  try {
    const data = await service.getOneForAttendant({
      userId: req.user.userId,
      exceptionId: req.params.exceptionId,
    });
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
};

const resolveAIException = async (req, res, next) => {
  try {
    const data = await service.resolveForAttendant({
      userId: req.user.userId,
      exceptionId: req.params.exceptionId,
      payload: req.body,
    });
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
};

const getAIExceptionStats = async (req, res, next) => {
  try {
    const data = await service.getStatsForAttendant({
      userId: req.user.userId,
    });
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listAIExceptions,
  getAIExceptionById,
  resolveAIException,
  getAIExceptionStats,
};

