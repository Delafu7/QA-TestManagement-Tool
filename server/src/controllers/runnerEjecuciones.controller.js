const runnerEjecucionesService = require('../services/runnerEjecuciones.service');
const asyncHandler = require('../utils/asyncHandler');

const iniciar = asyncHandler(async (req, res) => {
  const { proyectoId, cicloId, tipoPruebaId, directorioRelativo, commandId, argumentosExtra } = req.body;
  const run = runnerEjecucionesService.iniciar({
    proyectoId,
    cicloId,
    tipoPruebaId,
    directorioRelativo: directorioRelativo || '',
    commandId,
    argumentosExtra,
    usuarioId: req.usuarioId,
  });
  res.status(201).json(run);
});

const list = asyncHandler(async (req, res) => {
  const { proyectoId, cicloId, tipoPruebaId, page, pageSize } = req.query;
  res.json(runnerEjecucionesService.list({ proyectoId, cicloId, tipoPruebaId, page, pageSize }));
});

const getById = asyncHandler(async (req, res) => {
  res.json(runnerEjecucionesService.getById(req.params.id));
});

const abortar = asyncHandler(async (req, res) => {
  res.json(runnerEjecucionesService.abortar(req.params.id));
});

// SSE servido a mano: sin EventSource en el cliente (no puede mandar la
// cabecera X-User-Id que exige la autenticación de esta app), así que el
// cliente consume esto con fetch + un lector de stream. El formato en el
// cable sigue siendo SSE estándar (`event:`/`data:`).
const stream = asyncHandler(async (req, res) => {
  const runId = req.params.id;
  const run = runnerEjecucionesService.getById(runId); // 404 si no existe

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const write = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  if (!runnerEjecucionesService.estaEnCurso(runId)) {
    write('output', { chunk: run.salida });
    write('end', { estado: run.estado, codigoSalida: run.codigoSalida, salidaTruncada: run.salidaTruncada });
    return res.end();
  }

  const snapshot = runnerEjecucionesService.streamSnapshot(runId);
  if (snapshot?.salida) write('output', { chunk: snapshot.salida });

  const onChunk = (texto) => write('output', { chunk: texto });
  const onEnd = ({ estado, codigoSalida, salidaTruncada }) => {
    write('end', { estado, codigoSalida, salidaTruncada });
    res.end();
  };

  runnerEjecucionesService.streamSubscribe(runId, { onChunk, onEnd });
  req.on('close', () => runnerEjecucionesService.streamUnsubscribe(runId, { onChunk, onEnd }));
});

module.exports = { iniciar, list, getById, abortar, stream };
