const tiposPruebaModel = require('../models/tiposPrueba.model');
const { slugify } = require('../utils/slug');
const { notFound, unprocessable } = require('../utils/errors');
const logger = require('../utils/logger');

const assertSlugLibre = (proyectoId, slug, excluirId = null) => {
  const existente = tiposPruebaModel.findBySlug(proyectoId, slug);
  if (existente && existente.id !== excluirId) {
    throw unprocessable('TIPO_PRUEBA_DUPLICADO', 'Ya existe un tipo de prueba con ese nombre en este proyecto');
  }
};

const listByProyecto = (proyectoId) => tiposPruebaModel.listByProyecto(proyectoId);

const getById = (id) => {
  const tipo = tiposPruebaModel.findById(id);
  if (!tipo) throw notFound('Tipo de prueba');
  return tipo;
};

const create = ({ proyectoId, nombre, color }) => {
  const slug = slugify(nombre);
  assertSlugLibre(proyectoId, slug);
  const tipo = tiposPruebaModel.create({ proyectoId, nombre, slug, color });
  logger.info({ tipo: 'evento_negocio', evento: 'tipo_prueba_creado', tipoPruebaId: tipo.id, proyectoId, nombre });
  return tipo;
};

const update = (id, fields) => {
  const current = tiposPruebaModel.findRawById(id);
  if (!current) throw notFound('Tipo de prueba');
  const nextFields = { ...fields };
  if (fields.nombre) {
    nextFields.slug = slugify(fields.nombre);
    assertSlugLibre(current.proyecto_id, nextFields.slug, id);
  }
  const tipo = tiposPruebaModel.update(id, nextFields);
  logger.info({ tipo: 'evento_negocio', evento: 'tipo_prueba_actualizado', tipoPruebaId: id, proyectoId: current.proyecto_id });
  return tipo;
};

const archivar = (id) => {
  const current = tiposPruebaModel.findRawById(id);
  if (!current) throw notFound('Tipo de prueba');
  const tipo = tiposPruebaModel.archivar(id);
  logger.info({ tipo: 'evento_negocio', evento: 'tipo_prueba_archivado', tipoPruebaId: id, proyectoId: current.proyecto_id });
  return tipo;
};

module.exports = { listByProyecto, getById, create, update, archivar };
