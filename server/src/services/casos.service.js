const casosModel = require('../models/casos.model');
const suitesModel = require('../models/suites.model');
const tiposPruebaModel = require('../models/tiposPrueba.model');
const { notFound, conflict, unprocessable, badRequest } = require('../utils/errors');

const list = (suiteId, query) => casosModel.list(suiteId, query);

const getById = (id) => {
  const caso = casosModel.findById(id);
  if (!caso) throw notFound('Caso de prueba');
  return caso;
};

// Resuelve el `tipoPruebaId` final para un caso: si el cliente lo manda explícito
// se valida que pertenezca al proyecto del caso; si no, se intenta emparejar por el
// slug del `tipo` legado (siempre debería existir, todo proyecto tiene los 8 tipos
// por defecto sembrados). Si no se puede resolver nada, se deja como estaba.
const resolverTipoPruebaId = (proyectoId, { tipoPruebaId, tipo }, actual = null) => {
  if (tipoPruebaId) {
    const tipoPrueba = tiposPruebaModel.findById(tipoPruebaId);
    if (!tipoPrueba || tipoPrueba.proyectoId !== proyectoId) {
      throw badRequest('tipoPruebaId no corresponde a un tipo de prueba de este proyecto');
    }
    return tipoPrueba.id;
  }
  if (tipo) {
    const tipoPrueba = tiposPruebaModel.findBySlug(proyectoId, tipo);
    if (tipoPrueba) return tipoPrueba.id;
  }
  return actual;
};

const create = (fields) => {
  if (!fields.pasos || fields.pasos.length === 0) {
    throw badRequest('El caso de prueba debe tener al menos un paso');
  }
  const suite = suitesModel.findById(fields.suiteId);
  if (!suite) throw notFound('Suite');
  const tipoPruebaId = resolverTipoPruebaId(suite.proyectoId, fields);
  return casosModel.create({ ...fields, tipoPruebaId });
};

const update = (id, fields, editadoPorId) => {
  const current = casosModel.findRawById(id);
  if (!current) throw notFound('Caso de prueba');
  if (fields.pasos && casosModel.countEjecucionesHistoricas(id) > 0) {
    throw unprocessable(
      'CASO_CON_EJECUCIONES',
      'No se pueden modificar los pasos de un caso con ejecuciones asociadas; use deprecar y cree un nuevo caso si necesita cambiar el flujo'
    );
  }
  let nextFields = fields;
  if (fields.tipoPruebaId !== undefined || fields.tipo !== undefined) {
    const suite = suitesModel.findById(current.suite_id);
    const tipoPruebaId = resolverTipoPruebaId(suite.proyectoId, fields, current.tipo_prueba_id);
    nextFields = { ...fields, tipoPruebaId };
  }
  return casosModel.update(id, nextFields, editadoPorId);
};

const versiones = (id) => {
  if (!casosModel.findRawById(id)) throw notFound('Caso de prueba');
  return casosModel.versiones(id);
};

const transicion = (id, transiciones) => {
  const caso = casosModel.findRawById(id);
  if (!caso) throw notFound('Caso de prueba');
  const nuevoEstado = transiciones[caso.estado];
  if (!nuevoEstado) {
    throw conflict(
      'INVALID_TRANSITION',
      `No se puede aplicar esta transición desde el estado '${caso.estado}'`
    );
  }
  return casosModel.setEstado(id, nuevoEstado);
};

const publicar = (id) => transicion(id, { borrador: 'activo' });
const deprecar = (id) => transicion(id, { activo: 'obsoleto' });
const reactivar = (id) => transicion(id, { obsoleto: 'activo' });

const remove = (id) => {
  const caso = casosModel.findRawById(id);
  if (!caso) throw notFound('Caso de prueba');
  if (casosModel.countEjecucionesHistoricas(id) > 0) {
    throw unprocessable(
      'CASO_CON_EJECUCIONES',
      'No se puede eliminar un caso con ejecuciones históricas; use deprecar en su lugar'
    );
  }
  casosModel.remove(id);
};

const assertActivo = (id) => {
  const caso = casosModel.findRawById(id);
  if (!caso) throw notFound('Caso de prueba');
  if (caso.estado === 'obsoleto') {
    throw unprocessable('CASO_OBSOLETO', 'No se puede asignar a un ciclo un caso obsoleto', { casoId: id });
  }
  return caso;
};

module.exports = { list, getById, create, update, publicar, deprecar, reactivar, remove, assertActivo, versiones };
