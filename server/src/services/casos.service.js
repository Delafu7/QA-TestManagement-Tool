const casosModel = require('../models/casos.model');
const { notFound, conflict, unprocessable, badRequest } = require('../utils/errors');

const list = (suiteId, query) => casosModel.list(suiteId, query);

const getById = (id) => {
  const caso = casosModel.findById(id);
  if (!caso) throw notFound('Caso de prueba');
  return caso;
};

const create = (fields) => {
  if (!fields.pasos || fields.pasos.length === 0) {
    throw badRequest('El caso de prueba debe tener al menos un paso');
  }
  return casosModel.create(fields);
};

const update = (id, fields) => {
  if (!casosModel.findRawById(id)) throw notFound('Caso de prueba');
  if (fields.pasos && casosModel.countEjecucionesHistoricas(id) > 0) {
    throw unprocessable(
      'CASO_CON_EJECUCIONES',
      'No se pueden modificar los pasos de un caso con ejecuciones asociadas; use deprecar y cree un nuevo caso si necesita cambiar el flujo'
    );
  }
  return casosModel.update(id, fields);
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

module.exports = { list, getById, create, update, publicar, deprecar, reactivar, remove, assertActivo };
