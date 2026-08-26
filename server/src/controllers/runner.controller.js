const runnerConfig = require('../config/runner');
const runnerWorkspace = require('../services/runnerWorkspace.service');
const asyncHandler = require('../utils/asyncHandler');
const { badRequest } = require('../utils/errors');

// Sin gating de RUNNER_ENABLED: el cliente necesita poder preguntar esto
// incluso con el runner apagado, para decidir si muestra el panel o no.
const status = asyncHandler(async (req, res) => {
  res.json({ habilitado: runnerConfig.isEnabled() });
});

const comandos = asyncHandler(async (req, res) => {
  res.json(runnerConfig.ALLOWED_COMMANDS.map(({ id, label }) => ({ id, label })));
});

const directorio = asyncHandler(async (req, res) => {
  const ruta = typeof req.query.ruta === 'string' ? req.query.ruta : '';
  res.json(runnerWorkspace.ls(ruta));
});

const cambiarDirectorio = asyncHandler(async (req, res) => {
  const { ruta, segmento } = req.body;
  if (!segmento) throw badRequest('segmento es obligatorio');
  const nuevaRuta = runnerWorkspace.cd(ruta || '', segmento);
  res.json(runnerWorkspace.ls(nuevaRuta));
});

module.exports = { status, comandos, directorio, cambiarDirectorio };
