const usuariosService = require('../services/usuarios.service');
const asyncHandler = require('../utils/asyncHandler');
const { badRequest } = require('../utils/errors');

const list = asyncHandler(async (req, res) => {
  const { rol, page, pageSize } = req.query;
  res.json(usuariosService.list({ rol, page, pageSize }));
});

const getById = asyncHandler(async (req, res) => {
  res.json(usuariosService.getById(req.params.id));
});

const create = asyncHandler(async (req, res) => {
  const { nombre, email, rol, avatarUrl } = req.body;
  if (!nombre || !email || !rol) throw badRequest('nombre, email y rol son obligatorios');
  if (!['qa', 'gestor'].includes(rol)) throw badRequest("rol debe ser 'qa' o 'gestor'");
  res.status(201).json(usuariosService.create({ nombre, email, rol, avatarUrl }));
});

const update = asyncHandler(async (req, res) => {
  res.json(usuariosService.update(req.params.id, req.body));
});

module.exports = { list, getById, create, update };
