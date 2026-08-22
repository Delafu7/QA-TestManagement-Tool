const ejecucionesService = require('../services/ejecuciones.service');
const asyncHandler = require('../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const { estado, ejecutorId } = req.query;
  res.json({ data: ejecucionesService.list(req.params.cicloId, { estado, ejecutorId }) });
});

const getById = asyncHandler(async (req, res) => {
  res.json(ejecucionesService.getById(req.params.id));
});

const listByCaso = asyncHandler(async (req, res) => {
  res.json({ data: ejecucionesService.listByCaso(req.params.casoId) });
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
