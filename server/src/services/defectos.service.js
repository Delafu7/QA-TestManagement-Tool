const defectosModel = require('../models/defectos.model');
const ejecucionesModel = require('../models/ejecuciones.model');
const { notFound, conflict } = require('../utils/errors');

const list = (proyectoId, query) => defectosModel.list(proyectoId, query);

const getById = (id) => {
  const defecto = defectosModel.findById(id);
  if (!defecto) throw notFound('Defecto');
  return defecto;
};

const createFromEjecucion = (ejecucionId, { titulo, descripcion, severidad, reportadoPorId }) => {
  const ejecucion = ejecucionesModel.findRawById(ejecucionId);
  if (!ejecucion) throw notFound('Ejecución');
  const proyectoId = ejecucionesModel.findProyectoId(ejecucionId);
  return defectosModel.create({
    proyectoId,
    ejecucionOrigenId: ejecucionId,
    titulo,
    descripcion,
    severidad,
    reportadoPorId,
  });
};

const transicion = (id, transiciones) => {
  const defecto = defectosModel.findById(id);
  if (!defecto) throw notFound('Defecto');
  const nuevoEstado = transiciones[defecto.estado];
  if (!nuevoEstado) {
    throw conflict('INVALID_TRANSITION', `No se puede aplicar esta transición desde el estado '${defecto.estado}'`);
  }
  return defectosModel.setEstado(id, nuevoEstado);
};

const asignar = (id) => transicion(id, { abierto: 'en_progreso', reabierto: 'en_progreso' });
const resolver = (id) => transicion(id, { en_progreso: 'resuelto' });
const verificar = (id) => transicion(id, { resuelto: 'cerrado' });
const reabrir = (id) => transicion(id, { resuelto: 'reabierto' });

module.exports = { list, getById, createFromEjecucion, asignar, resolver, verificar, reabrir };
