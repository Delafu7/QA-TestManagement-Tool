const casosService = require('../services/casos.service');
const asyncHandler = require('../utils/asyncHandler');
const { badRequest } = require('../utils/errors');

const list = asyncHandler(async (req, res) => {
  const { estado, prioridad, tipo, tipoPruebaId, etiqueta, page, pageSize } = req.query;
  res.json(casosService.list(req.params.suiteId, { estado, prioridad, tipo, tipoPruebaId, etiqueta, page, pageSize }));
});

const getById = asyncHandler(async (req, res) => {
  res.json(casosService.getById(req.params.id));
});

const create = asyncHandler(async (req, res) => {
  const { titulo, descripcion, precondiciones, prioridad, tipo, tipoPruebaId, etiquetaIds, pasos } = req.body;
  if (!titulo || !prioridad || !tipo) {
    throw badRequest('titulo, prioridad y tipo son obligatorios');
  }
  res.status(201).json(
    casosService.create({
      suiteId: req.params.suiteId,
      titulo,
      descripcion,
      precondiciones,
      prioridad,
      tipo,
      tipoPruebaId,
      etiquetaIds,
      pasos,
    })
  );
});

const update = asyncHandler(async (req, res) => {
  res.json(casosService.update(req.params.id, req.body));
});

const versiones = asyncHandler(async (req, res) => {
  res.json(casosService.versiones(req.params.id));
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

module.exports = { list, getById, create, update, publicar, deprecar, reactivar, remove, versiones };
