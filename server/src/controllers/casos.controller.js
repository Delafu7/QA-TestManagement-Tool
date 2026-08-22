const casosService = require('../services/casos.service');
const asyncHandler = require('../utils/asyncHandler');
const { badRequest } = require('../utils/errors');

const list = asyncHandler(async (req, res) => {
  const { estado, prioridad, tipo, etiqueta, page, pageSize } = req.query;
  res.json(casosService.list(req.params.suiteId, { estado, prioridad, tipo, etiqueta, page, pageSize }));
});

const getById = asyncHandler(async (req, res) => {
  res.json(casosService.getById(req.params.id));
});

const create = asyncHandler(async (req, res) => {
  const { titulo, descripcion, precondiciones, prioridad, tipo, etiquetaIds, autorId, pasos } = req.body;
  if (!titulo || !prioridad || !tipo || !autorId) {
    throw badRequest('titulo, prioridad, tipo y autorId son obligatorios');
  }
  res.status(201).json(
    casosService.create({
      suiteId: req.params.suiteId,
      titulo,
      descripcion,
      precondiciones,
      prioridad,
      tipo,
      etiquetaIds,
      autorId,
      pasos,
    })
  );
});

const update = asyncHandler(async (req, res) => {
  res.json(casosService.update(req.params.id, req.body));
});

const publicar = asyncHandler(async (req, res) => {
  res.json(casosService.publicar(req.params.id));
});

const deprecar = asyncHandler(async (req, res) => {
  res.json(casosService.deprecar(req.params.id));
});

const reactivar = asyncHandler(async (req, res) => {
  res.json(casosService.reactivar(req.params.id));
});

const remove = asyncHandler(async (req, res) => {
  casosService.remove(req.params.id);
  res.status(204).send();
});

module.exports = { list, getById, create, update, publicar, deprecar, reactivar, remove };
