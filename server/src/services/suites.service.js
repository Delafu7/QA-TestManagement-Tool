const suitesModel = require('../models/suites.model');
const ciclosModel = require('../models/ciclos.model');
const { notFound, unprocessable } = require('../utils/errors');

const treeByProyecto = (proyectoId) => suitesModel.buildTree(proyectoId);

const getById = (id) => {
  const suite = suitesModel.findById(id);
  if (!suite) throw notFound('Suite');
  const cicloActivo = ciclosModel.findActivo(suite.proyectoId);
  return { ...suite, cobertura: suitesModel.cobertura(id, cicloActivo ? cicloActivo.id : null) };
};

const create = (fields) => suitesModel.create(fields);

const update = (id, fields) => {
  const suite = suitesModel.update(id, fields);
  if (!suite) throw notFound('Suite');
  return suite;
};

const remove = (id) => {
  const suite = suitesModel.findById(id);
  if (!suite) throw notFound('Suite');
  if (suitesModel.countCasosActivos(id) > 0) {
    throw unprocessable('SUITE_CON_CASOS_ACTIVOS', 'No se puede eliminar una suite con casos de prueba activos');
  }
  // Un caso en borrador/obsoleto no bloquea por la regla de negocio anterior, pero
  // casos_prueba.suite_id es una FK NOT NULL sin cascada: dejarlo pasar rompería el
  // DELETE. Igual para sub-suites (suite_padre_id).
  if (suitesModel.countCasos(id) > 0) {
    throw unprocessable(
      'SUITE_NO_VACIA',
      'No se puede eliminar una suite que todavía contiene casos de prueba (en borrador u obsoletos); muévalos o elimínelos primero'
    );
  }
  if (suitesModel.countHijas(id) > 0) {
    throw unprocessable(
      'SUITE_CON_SUBSUITES',
      'No se puede eliminar una suite que todavía tiene sub-suites; muévalas o elimínelas primero'
    );
  }
  suitesModel.remove(id);
};

module.exports = { treeByProyecto, getById, create, update, remove };
