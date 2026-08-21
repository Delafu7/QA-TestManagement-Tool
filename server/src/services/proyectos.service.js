const proyectosModel = require('../models/proyectos.model');
const { notFound } = require('../utils/errors');

const list = (query) => proyectosModel.list(query);

const getById = (id) => {
  const proyecto = proyectosModel.findById(id);
  if (!proyecto) throw notFound('Proyecto');
  return { ...proyecto, ...proyectosModel.metricasResumen(id) };
};

const create = (fields) => proyectosModel.create(fields);

const update = (id, fields) => {
  const proyecto = proyectosModel.update(id, fields);
  if (!proyecto) throw notFound('Proyecto');
  return proyecto;
};

const archivar = (id) => {
  if (!proyectosModel.findById(id)) throw notFound('Proyecto');
  return proyectosModel.setEstado(id, 'archivado');
};

module.exports = { list, getById, create, update, archivar };
