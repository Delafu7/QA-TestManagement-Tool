const runnerRunsModel = require('../models/runnerRuns.model');
const runnerWorkspace = require('./runnerWorkspace.service');
const runnerProceso = require('./runnerProceso.service');
const proyectosModel = require('../models/proyectos.model');
const ciclosModel = require('../models/ciclos.model');
const tiposPruebaModel = require('../models/tiposPrueba.model');
const { AppError, notFound, badRequest, conflict } = require('../utils/errors');
const logger = require('../utils/logger');

const iniciarInterno = ({ proyectoId, cicloId, tipoPruebaId, directorioRelativo, commandId, argumentosExtra, usuarioId }) => {
  if (!proyectoId) throw badRequest('proyectoId es obligatorio');
  if (!commandId) throw badRequest('commandId es obligatorio');
  if (!proyectosModel.findById(proyectoId)) throw notFound('Proyecto');
  if (cicloId && !ciclosModel.findById(cicloId)) throw notFound('Fase/Ciclo');
  if (tipoPruebaId && !tiposPruebaModel.findById(tipoPruebaId)) throw notFound('Tipo de prueba');

  const { bin, args } = runnerProceso.validarComando(commandId, argumentosExtra);
  const cwdAbsoluto = runnerWorkspace.resolveCwdAbsoluto(directorioRelativo);
  const directorioNormalizado = runnerWorkspace.pwd(directorioRelativo);

  const run = runnerRunsModel.create({
    proyectoId,
    cicloId,
    tipoPruebaId,
    directorioRelativo: directorioNormalizado,
    comando: bin,
    argumentos: args,
    iniciadoPorId: usuarioId,
  });

  logger.info({
    tipo: 'evento_negocio',
    evento: 'runner_run_iniciado',
    runId: run.id,
    proyectoId,
    cicloId: cicloId || null,
    comando: bin,
    argumentos: args,
  });

  runnerProceso.iniciarProceso({ runId: run.id, bin, args, cwd: cwdAbsoluto });
  runnerProceso.suscribir(run.id, {
    onEnd: ({ estado, codigoSalida, salida, salidaTruncada }) => {
      runnerRunsModel.finalizar(run.id, { estado, codigoSalida, salida, salidaTruncada });
      logger.info({
        tipo: 'evento_negocio',
        evento: estado === 'timeout' ? 'runner_run_timeout' : 'runner_run_finalizado',
        runId: run.id,
        proyectoId,
        estado,
        codigoSalida,
      });
    },
  });

  return run;
};

// Cualquier rechazo (comando fuera de la lista blanca, ruta fuera del
// workspace, proyecto/ciclo/tipo de prueba inexistente...) se registra como
// negocio antes de propagar el error, para que quede visible en Kibana igual
// que un arranque o un final de ejecución.
const iniciar = (params) => {
  try {
    return iniciarInterno(params);
  } catch (err) {
    if (err instanceof AppError) {
      logger.info({
        tipo: 'evento_negocio',
        evento: 'runner_run_rechazado',
        proyectoId: params.proyectoId || null,
        motivo: err.message,
        errorCode: err.code,
      });
    }
    throw err;
  }
};

const getById = (id) => {
  const run = runnerRunsModel.findById(id);
  if (!run) throw notFound('Ejecución de runner');
  return run;
};

const list = (query) => runnerRunsModel.list(query);

const abortar = (id) => {
  const run = getById(id);
  if (run.estado !== 'en_progreso' || !runnerProceso.abortar(id)) {
    throw conflict('RUNNER_RUN_NO_ACTIVO', 'Esta ejecución ya ha finalizado');
  }
  return getById(id);
};

const streamSubscribe = (id, listeners) => runnerProceso.suscribir(id, listeners);
const streamUnsubscribe = (id, listeners) => runnerProceso.desuscribir(id, listeners);
const estaEnCurso = (id) => runnerProceso.estaEnCurso(id);
const streamSnapshot = (id) => runnerProceso.snapshot(id);

module.exports = { iniciar, getById, list, abortar, streamSubscribe, streamUnsubscribe, estaEnCurso, streamSnapshot };
