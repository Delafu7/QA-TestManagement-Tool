const proyectosService = require('../services/proyectos.service');
const asyncHandler = require('../utils/asyncHandler');
const { badRequest } = require('../utils/errors');

const list = asyncHandler(async (req, res) => {
  const { estado, page, pageSize } = req.query;
  res.json(proyectosService.list({ estado, page, pageSize }));
});

const getById = asyncHandler(async (req, res) => {
  res.json(proyectosService.getById(req.params.id));
});

const create = asyncHandler(async (req, res) => {
  const { nombre, descripcion, propietarioId } = req.body;
  if (!nombre || !propietarioId) throw badRequest('nombre y propietarioId son obligatorios');
  res.status(201).json(proyectosService.create({ nombre, descripcion, propietarioId }));
});

const update = asyncHandler(async (req, res) => {
  res.json(proyectosService.update(req.params.id, req.body));
});

const archivar = asyncHandler(async (req, res) => {
  res.json(proyectosService.archivar(req.params.id));
});

module.exports = { list, getById, create, update, archivar };
