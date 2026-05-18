class AppError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_SERVER_ERROR", details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

class ValidationError extends AppError {
  constructor(message = "Validation failed", details = null) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

class ConflictError extends AppError {
  constructor(message = "Conflict detected", details = null) {
    super(message, 409, "CONFLICT_ERROR", details);
  }
}

class NotFoundError extends AppError {
  constructor(message = "Resource not found", details = null) {
    super(message, 404, "NOT_FOUND_ERROR", details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", details = null) {
    super(message, 401, "UNAUTHORIZED_ERROR", details);
  }
}

class ForbiddenError extends AppError {
  constructor(message = "Forbidden", details = null) {
    super(message, 403, "FORBIDDEN_ERROR", details);
  }
}

class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests", details = null) {
    super(message, 429, "TOO_MANY_REQUESTS", details);
  }
}

class InternalServerError extends AppError {
  constructor(message = "Internal server error", details = null) {
    super(message, 500, "INTERNAL_SERVER_ERROR", details);
  }
}

module.exports = {
  AppError,
  ValidationError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  TooManyRequestsError,
  InternalServerError,
};
