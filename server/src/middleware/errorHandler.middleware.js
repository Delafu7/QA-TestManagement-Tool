const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

const errorHandler = (err, req, res, next) => {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const code = isAppError ? err.code : 'INTERNAL_ERROR';
  const message = isAppError ? err.message : 'Error interno del servidor';
  const details = isAppError ? err.details : {};

  logger.error({
    tipo: 'app_error',
    metodo: req.method,
    ruta: req.originalUrl,
    statusCode,
    errorCode: code,
    mensaje: message,
    usuarioId: req.usuarioId || null,
    ...(isAppError ? {} : { stack: err.stack }),
  });

  res.status(statusCode).json({ error: { code, message, details } });
};

module.exports = errorHandler;
