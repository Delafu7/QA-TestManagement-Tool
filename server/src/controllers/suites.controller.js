const suitesService = require('../services/suites.service');
const asyncHandler = require('../utils/asyncHandler');
const { badRequest } = require('../utils/errors');

const tree = asyncHandler(async (req, res) => {
  res.json({ data: suitesService.treeByProyecto(req.params.proyectoId) });
});

const getById = asyncHandler(async (req, res) => {
  res.json(suitesService.getById(req.params.id));
});

const create = asyncHandler(async (req, res) => {
  const { nombre, descripcion, suitePadreId } = req.body;
  if (!nombre) throw badRequest('nombre es obligatorio');
  res.status(201).json(
    suitesService.create({ proyectoId: req.params.proyectoId, nombre, descripcion, suitePadreId })
  );
});

const update = asyncHandler(async (req, res) => {
  res.json(suitesService.update(req.params.id, req.body));
});

const remove = asyncHandler(async (req, res) => {
  suitesService.remove(req.params.id);
  res.status(204).send();
});

module.exports = { tree, getById, create, update, remove };
