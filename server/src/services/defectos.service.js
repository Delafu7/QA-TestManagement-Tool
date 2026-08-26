const defectosModel = require('../models/defectos.model');
const ejecucionesModel = require('../models/ejecuciones.model');
const proyectosModel = require('../models/proyectos.model');
const tiposPruebaModel = require('../models/tiposPrueba.model');
const { notFound, conflict, badRequest } = require('../utils/errors');

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
    // El tipo de prueba se hereda siempre de la ejecución de origen: no se acepta
    // como entrada manual cuando el defecto viene de una ejecución.
    tipoPruebaId: ejecucion.tipo_prueba_id,
    titulo,
    descripcion,
    severidad,
    reportadoPorId,
  });
};

const createStandalone = (proyectoId, { tipoPruebaId, titulo, descripcion, severidad, reportadoPorId }) => {
  if (!proyectosModel.findById(proyectoId)) throw notFound('Proyecto');
  if (!tipoPruebaId) throw badRequest('tipoPruebaId es obligatorio al reportar un defecto sin ejecución de origen');
  const tipoPrueba = tiposPruebaModel.findById(tipoPruebaId);
  if (!tipoPrueba || tipoPrueba.proyectoId !== proyectoId) {
    throw badRequest('tipoPruebaId no corresponde a un tipo de prueba de este proyecto');
  }
  return defectosModel.create({
    proyectoId,
    ejecucionOrigenId: null,
    tipoPruebaId,
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

module.exports = { list, getById, createFromEjecucion, createStandalone, asignar, resolver, verificar, reabrir };
