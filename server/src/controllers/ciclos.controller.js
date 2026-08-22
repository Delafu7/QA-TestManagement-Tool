const ciclosService = require('../services/ciclos.service');
const asyncHandler = require('../utils/asyncHandler');
const { badRequest } = require('../utils/errors');

const list = asyncHandler(async (req, res) => {
  const { estado, page, pageSize } = req.query;
  res.json(ciclosService.list(req.params.proyectoId, { estado, page, pageSize }));
});

const getById = asyncHandler(async (req, res) => {
  res.json(ciclosService.getById(req.params.id));
});

const create = asyncHandler(async (req, res) => {
  const { nombre, descripcion, fechaInicio, fechaFinPrevista, responsableId } = req.body;
  if (!nombre || !fechaInicio || !fechaFinPrevista || !responsableId) {
    throw badRequest('nombre, fechaInicio, fechaFinPrevista y responsableId son obligatorios');
  }
  res.status(201).json(
    ciclosService.create({
      proyectoId: req.params.proyectoId,
      nombre,
      descripcion,
      fechaInicio,
      fechaFinPrevista,
      responsableId,
    })
  );
});

const asignarCasos = asyncHandler(async (req, res) => {
  const { casoIds } = req.body;
  res.status(201).json({ data: ciclosService.asignarCasos(req.params.id, casoIds) });
});

const iniciar = asyncHandler(async (req, res) => {
  res.json(ciclosService.iniciar(req.params.id));
});

const bloquear = asyncHandler(async (req, res) => {
  res.json(ciclosService.bloquear(req.params.id, req.body.comentario));
});

const desbloquear = asyncHandler(async (req, res) => {
  res.json(ciclosService.desbloquear(req.params.id));
});

const completar = asyncHandler(async (req, res) => {
  res.json(ciclosService.completar(req.params.id));
});

const coberturaPorSuite = asyncHandler(async (req, res) => {
  res.json({ data: ciclosService.coberturaPorSuite(req.params.id) });
});

module.exports = { list, getById, create, asignarCasos, iniciar, bloquear, desbloquear, completar, coberturaPorSuite };
