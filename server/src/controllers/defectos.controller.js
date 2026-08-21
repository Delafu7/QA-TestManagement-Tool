const defectosService = require('../services/defectos.service');
const asyncHandler = require('../utils/asyncHandler');
const { badRequest } = require('../utils/errors');

const list = asyncHandler(async (req, res) => {
  const { estado, severidad } = req.query;
  res.json({ data: defectosService.list(req.params.proyectoId, { estado, severidad }) });
});

const getById = asyncHandler(async (req, res) => {
  res.json(defectosService.getById(req.params.id));
});

const createFromEjecucion = asyncHandler(async (req, res) => {
  const { titulo, descripcion, severidad, reportadoPorId } = req.body;
  if (!titulo || !severidad || !reportadoPorId) {
    throw badRequest('titulo, severidad y reportadoPorId son obligatorios');
  }
  res.status(201).json(
    defectosService.createFromEjecucion(req.params.id, { titulo, descripcion, severidad, reportadoPorId })
  );
});

const asignar = asyncHandler(async (req, res) => {
  res.json(defectosService.asignar(req.params.id));
});

const resolver = asyncHandler(async (req, res) => {
  res.json(defectosService.resolver(req.params.id));
});

const verificar = asyncHandler(async (req, res) => {
  res.json(defectosService.verificar(req.params.id));
});

const reabrir = asyncHandler(async (req, res) => {
  res.json(defectosService.reabrir(req.params.id));
});

module.exports = { list, getById, createFromEjecucion, asignar, resolver, verificar, reabrir };
