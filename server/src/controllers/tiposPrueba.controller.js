const tiposPruebaService = require('../services/tiposPrueba.service');
const asyncHandler = require('../utils/asyncHandler');
const { badRequest } = require('../utils/errors');

const list = asyncHandler(async (req, res) => {
  res.json(tiposPruebaService.listByProyecto(req.params.proyectoId));
});

const getById = asyncHandler(async (req, res) => {
  res.json(tiposPruebaService.getById(req.params.id));
});

const create = asyncHandler(async (req, res) => {
  const { nombre, color } = req.body;
  if (!nombre || !color) throw badRequest('nombre y color son obligatorios');
  res.status(201).json(tiposPruebaService.create({ proyectoId: req.params.proyectoId, nombre, color }));
});

const update = asyncHandler(async (req, res) => {
  const { nombre, color } = req.body;
  res.json(tiposPruebaService.update(req.params.id, { nombre, color }));
});

const archivar = asyncHandler(async (req, res) => {
  res.json(tiposPruebaService.archivar(req.params.id));
});

module.exports = { list, getById, create, update, archivar };
