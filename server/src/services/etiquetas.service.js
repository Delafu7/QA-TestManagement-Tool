const etiquetasModel = require('../models/etiquetas.model');
const { notFound, unprocessable } = require('../utils/errors');

const listByProyecto = (proyectoId, query) => etiquetasModel.listByProyecto(proyectoId, query);

const create = ({ proyectoId, nombre, color }) => etiquetasModel.create({ proyectoId, nombre, color });

const remove = (id) => {
  const etiqueta = etiquetasModel.findById(id);
  if (!etiqueta) throw notFound('Etiqueta');
  if (etiquetasModel.countCasosConEtiqueta(id) > 0) {
    throw unprocessable('ETIQUETA_EN_USO', 'No se puede eliminar una etiqueta asignada a casos de prueba');
  }
  etiquetasModel.remove(id);
};

module.exports = { listByProyecto, create, remove };
