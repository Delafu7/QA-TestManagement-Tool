const ciclosModel = require('../models/ciclos.model');
const ejecucionesModel = require('../models/ejecuciones.model');
const casosService = require('./casos.service');
const { notFound, conflict, badRequest } = require('../utils/errors');
const { now } = require('../utils/ids');

const list = (proyectoId, query) => ciclosModel.list(proyectoId, query);

const getById = (id) => {
  const ciclo = ciclosModel.findById(id);
  if (!ciclo) throw notFound('Fase/Ciclo');
  return { ...ciclo, ...ciclosModel.metricas(id) };
};

const create = (fields) => ciclosModel.create(fields);

const asignarCasos = (cicloId, casoIds) => {
  if (!ciclosModel.findById(cicloId)) throw notFound('Fase/Ciclo');
  if (!casoIds || casoIds.length === 0) throw badRequest('casoIds no puede estar vacío');
  for (const casoId of casoIds) {
    casosService.assertActivo(casoId);
  }
  return ejecucionesModel.createBulk(cicloId, casoIds);
};

const transicion = (id, transiciones, opts = {}) => {
  const ciclo = ciclosModel.findById(id);
  if (!ciclo) throw notFound('Fase/Ciclo');
  const nuevoEstado = transiciones[ciclo.estado];
  if (!nuevoEstado) {
    throw conflict('INVALID_TRANSITION', `No se puede pasar de '${ciclo.estado}' a este estado`);
  }
  return ciclosModel.setEstado(id, nuevoEstado, opts);
};

const iniciar = (id) => transicion(id, { planificada: 'en_progreso' });

const bloquear = (id, comentario) => {
  if (!comentario) throw badRequest('Se requiere un comentario para bloquear el ciclo');
  return transicion(id, { en_progreso: 'bloqueada' }, { comentario });
};

const desbloquear = (id) => transicion(id, { bloqueada: 'en_progreso' });

const completar = (id) => transicion(id, { en_progreso: 'completada' }, { fechaFinReal: now().slice(0, 10) });

const coberturaPorSuite = (id) => {
  if (!ciclosModel.findById(id)) throw notFound('Fase/Ciclo');
  return ciclosModel.coberturaPorSuite(id);
};

module.exports = { list, getById, create, asignarCasos, iniciar, bloquear, desbloquear, completar, coberturaPorSuite };
