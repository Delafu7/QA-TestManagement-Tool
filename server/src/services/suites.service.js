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
  suitesModel.remove(id);
};

module.exports = { treeByProyecto, getById, create, update, remove };
