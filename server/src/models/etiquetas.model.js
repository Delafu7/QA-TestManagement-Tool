const db = require('../db/connection');
const { newId } = require('../utils/ids');
const { parsePagination } = require('../utils/pagination');

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

const listByProyecto = (proyectoId, { page, pageSize } = {}) => {
  const { page: p, pageSize: ps, offset } = parsePagination({ page, pageSize });
  const total = db.prepare('SELECT COUNT(*) AS n FROM etiquetas WHERE proyecto_id = ?').get(proyectoId).n;
  const rows = db
    .prepare('SELECT * FROM etiquetas WHERE proyecto_id = ? ORDER BY nombre LIMIT ? OFFSET ?')
    .all(proyectoId, ps, offset);
  return { data: rows.map(toApi), pagination: { page: p, pageSize: ps, total } };
};

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
