class AppError extends Error {
  constructor(statusCode, code, message, details = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

const badRequest = (message, details) => new AppError(400, 'BAD_REQUEST', message, details);
const unauthorized = (message = 'Falta el header X-User-Id') => new AppError(401, 'UNAUTHORIZED', message);
const forbidden = (message = 'El rol del usuario no tiene permiso para esta acción') => new AppError(403, 'FORBIDDEN', message);
const notFound = (resource) => new AppError(404, 'NOT_FOUND', `${resource} no encontrado`);
const conflict = (code, message, details) => new AppError(409, code, message, details);
const unprocessable = (code, message, details) => new AppError(422, code, message, details);

module.exports = { AppError, badRequest, unauthorized, forbidden, notFound, conflict, unprocessable };
