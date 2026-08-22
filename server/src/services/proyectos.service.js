const proyectosModel = require('../models/proyectos.model');
const casoVersionesModel = require('../models/casoVersiones.model');
const { notFound } = require('../utils/errors');

const DIAS_PERIODO_DEFECTO = 7;

// `desde`/`hasta` llegan como fecha (YYYY-MM-DD) desde el selector de periodo del
// dashboard; se normalizan a límites de día en ISO para comparar con `creado_en`
// (timestamp completo) sin dejar fuera el propio día `hasta`. Si faltan, caemos a
// "últimos 7 días" en vez de devolver 400 (mismo criterio que parsePagination).
const normalizarPeriodo = ({ desde, hasta }) => {
  const hastaDate = hasta ? new Date(`${hasta}T23:59:59.999Z`) : new Date();
  const desdeDate = desde
    ? new Date(`${desde}T00:00:00.000Z`)
    : new Date(hastaDate.getTime() - DIAS_PERIODO_DEFECTO * 24 * 60 * 60 * 1000);
  return { desde: desdeDate.toISOString(), hasta: hastaDate.toISOString() };
};

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

const casosModificados = (id, { desde, hasta, page, pageSize } = {}) => {
  if (!proyectosModel.findById(id)) throw notFound('Proyecto');
  const periodo = normalizarPeriodo({ desde, hasta });
  return casoVersionesModel.modificadosEnPeriodo(id, { ...periodo, page, pageSize });
};

module.exports = { list, getById, create, update, archivar, casosModificados };
