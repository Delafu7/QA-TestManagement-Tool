const { notFound } = require('../utils/errors');

const notFoundHandler = (req, res, next) => next(notFound('Ruta'));

module.exports = notFoundHandler;
