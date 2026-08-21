const db = require('../db/connection');
const { newId } = require('../utils/ids');

const toApi = (row) => ({
  id: row.id,
  proyectoId: row.proyecto_id,
  nombre: row.nombre,
  color: row.color,
});

const findById = (id) => {
  const row = db.prepare('SELECT * FROM etiquetas WHERE id = ?').get(id);
  return row ? toApi(row) : null;
};

const listByProyecto = (proyectoId) =>
  db.prepare('SELECT * FROM etiquetas WHERE proyecto_id = ? ORDER BY nombre').all(proyectoId).map(toApi);

const create = ({ proyectoId, nombre, color }) => {
  const id = newId();
  db.prepare('INSERT INTO etiquetas (id, proyecto_id, nombre, color) VALUES (?, ?, ?, ?)').run(
    id,
    proyectoId,
    nombre,
    color
  );
  return findById(id);
};

const remove = (id) => db.prepare('DELETE FROM etiquetas WHERE id = ?').run(id);

const countCasosConEtiqueta = (id) =>
  db.prepare('SELECT COUNT(*) AS n FROM caso_etiquetas WHERE etiqueta_id = ?').get(id).n;

module.exports = { findById, listByProyecto, create, remove, countCasosConEtiqueta };
