const logger = require('../utils/logger');

const requestLogger = (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const duracionMs = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info({
      tipo: 'http_request',
      metodo: req.method,
      ruta: req.originalUrl,
      statusCode: res.statusCode,
      duracionMs: Math.round(duracionMs),
      usuarioId: req.usuarioId || null,
    });
  });
  next();
};

module.exports = requestLogger;
