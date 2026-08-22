const ejecucionesModel = require('../models/ejecuciones.model');
const casosModel = require('../models/casos.model');
const { notFound, conflict, unprocessable } = require('../utils/errors');
const logger = require('../utils/logger');

const list = (cicloId, query) => ejecucionesModel.list(cicloId, query);

const getById = (id) => {
  const ejecucion = ejecucionesModel.findById(id);
  if (!ejecucion) throw notFound('Ejecución');
  return ejecucion;
};

const tomar = (id, ejecutorId) => {
  const ejecucion = ejecucionesModel.findRawById(id);
  if (!ejecucion) throw notFound('Ejecución');
  if (ejecucion.estado !== 'pendiente') {
    throw conflict('INVALID_TRANSITION', "Solo se puede tomar una ejecución en estado 'pendiente'");
  }
  return ejecucionesModel.tomar(id, ejecutorId);
};

const ESTADOS_RESULTADO = ['passed', 'failed', 'blocked', 'skipped'];

const registrarResultado = (id, { estado, comentario, duracionSegundos, resultadosPaso = [] }) => {
  const ejecucion = ejecucionesModel.findRawById(id);
  if (!ejecucion) throw notFound('Ejecución');
  if (ejecucion.estado !== 'en_progreso') {
    throw conflict('INVALID_TRANSITION', "Solo se puede cerrar el resultado de una ejecución 'en_progreso'");
  }
  if (!ESTADOS_RESULTADO.includes(estado)) {
    throw conflict('INVALID_TRANSITION', `Estado de resultado no válido: ${estado}`);
  }

  const pasosDelCaso = casosModel.pasosDeCaso(ejecucion.caso_id).map((p) => p.id);
  const pasosCubiertos = resultadosPaso.map((r) => r.pasoId);
  const faltantes = pasosDelCaso.filter((pid) => !pasosCubiertos.includes(pid));
  if (faltantes.length > 0) {
    throw unprocessable('PASOS_INCOMPLETOS', 'resultadosPaso no cubre todos los pasos del caso', {
      pasoIdsFaltantes: faltantes,
    });
  }

  const resultado = ejecucionesModel.cerrarResultado(id, { estado, comentario, duracionSegundos, resultadosPaso });
  const { casoTitulo, suiteNombre } = ejecucionesModel.findContextoNegocio(id);

  logger.info({
    tipo: 'evento_negocio',
    evento: 'ejecucion_cerrada',
    cicloId: resultado.cicloId,
    casoId: resultado.casoId,
    casoTitulo,
    suiteNombre,
    estadoResultado: resultado.estado,
    duracionSegundosEjecucion: resultado.duracionSegundos,
  });

  return resultado;
};

const reintentar = (id) => {
  const ejecucion = ejecucionesModel.findRawById(id);
  if (!ejecucion) throw notFound('Ejecución');
  if (!['failed', 'blocked'].includes(ejecucion.estado)) {
    throw conflict('INVALID_TRANSITION', "Solo se puede reintentar una ejecución 'failed' o 'blocked'");
  }
  return ejecucionesModel.reintentar(id);
};

module.exports = { list, getById, tomar, registrarResultado, reintentar };
