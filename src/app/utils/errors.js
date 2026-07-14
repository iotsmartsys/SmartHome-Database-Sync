class ApplicationError extends Error {
  constructor(message, { code = 'APPLICATION_ERROR', cause, details, retryable = false } = {}) {
    super(message, { cause });
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.retryable = retryable;
  }
}

class ValidationError extends ApplicationError {
  constructor(message, details) {
    super(message, { code: 'VALIDATION_ERROR', details, retryable: false });
  }
}

class NotFoundError extends ApplicationError {
  constructor(message, { cause, details, response } = {}) {
    super(message, { code: 'NOT_FOUND', cause, details, retryable: false });
    this.status = 404;
    this.response = response;
  }
}

class InfrastructureError extends ApplicationError {
  constructor(message, { cause, details, status, response } = {}) {
    super(message, {
      code: 'INFRASTRUCTURE_ERROR',
      cause,
      details,
      retryable:
        status === undefined ||
        status === null ||
        status === 408 ||
        status === 429 ||
        status >= 500,
    });
    this.status = status;
    this.response = response;
  }
}

function getHttpStatus(error) {
  return error?.status ?? error?.response?.status;
}

function isNotFoundError(error) {
  return getHttpStatus(error) === 404;
}

function toInfrastructureError(error, message, details) {
  if (error instanceof ApplicationError) return error;

  const status = getHttpStatus(error);
  const response = error?.response?.data;
  if (status === 404) {
    return new NotFoundError(message, { cause: error, details, response });
  }
  return new InfrastructureError(message, { cause: error, details, status, response });
}

module.exports = {
  ApplicationError,
  ValidationError,
  NotFoundError,
  InfrastructureError,
  getHttpStatus,
  isNotFoundError,
  toInfrastructureError,
};
