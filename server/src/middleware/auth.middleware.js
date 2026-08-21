const db = require('../db/connection');
const { unauthorized } = require('../utils/errors');

const identifyUser = (req, res, next) => {
  const usuarioId = req.header('X-User-Id');
  if (!usuarioId) return next(unauthorized());

  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ? AND activo = 1').get(usuarioId);
  if (!usuario) return next(unauthorized('X-User-Id no corresponde a un usuario activo'));

  req.usuarioId = usuario.id;
  req.usuarioRol = usuario.rol;
  next();
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.usuarioRol)) {
    return next(require('../utils/errors').forbidden());
  }
  next();
};

module.exports = { identifyUser, requireRole };
