const ejecucionesService = require('../services/ejecuciones.service');
const asyncHandler = require('../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const { estado, ejecutorId, page, pageSize } = req.query;
  res.json(ejecucionesService.list(req.params.cicloId, { estado, ejecutorId, page, pageSize }));
});

const getById = asyncHandler(async (req, res) => {
  res.json(ejecucionesService.getById(req.params.id));
});

const listByCaso = asyncHandler(async (req, res) => {
  const { page, pageSize } = req.query;
  res.json(ejecucionesService.listByCaso(req.params.casoId, { page, pageSize }));
});

const tomar = asyncHandler(async (req, res) => {
  res.json(ejecucionesService.tomar(req.params.id, req.usuarioId));
});

const registrarResultado = asyncHandler(async (req, res) => {
  const { estado, comentario, duracionSegundos, resultadosPaso } = req.body;
  res.json(ejecucionesService.registrarResultado(req.params.id, { estado, comentario, duracionSegundos, resultadosPaso }));
});

const reintentar = asyncHandler(async (req, res) => {
  res.json(ejecucionesService.reintentar(req.params.id));
});

module.exports = { list, listByCaso, getById, tomar, registrarResultado, reintentar };
