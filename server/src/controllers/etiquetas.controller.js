const etiquetasService = require('../services/etiquetas.service');
const asyncHandler = require('../utils/asyncHandler');
const { badRequest } = require('../utils/errors');

const list = asyncHandler(async (req, res) => {
  res.json({ data: etiquetasService.listByProyecto(req.params.proyectoId) });
});

const create = asyncHandler(async (req, res) => {
  const { nombre, color } = req.body;
  if (!nombre || !color) throw badRequest('nombre y color son obligatorios');
  res.status(201).json(etiquetasService.create({ proyectoId: req.params.proyectoId, nombre, color }));
});

const remove = asyncHandler(async (req, res) => {
  etiquetasService.remove(req.params.id);
  res.status(204).send();
});

module.exports = { list, create, remove };
