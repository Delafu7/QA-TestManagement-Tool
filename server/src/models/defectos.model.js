const db = require('../db/connection');
const { newId, now } = require('../utils/ids');

const toApi = (row) => ({
  id: row.id,
  proyectoId: row.proyecto_id,
  ejecucionOrigenId: row.ejecucion_origen_id,
  titulo: row.titulo,
  descripcion: row.descripcion,
  severidad: row.severidad,
  estado: row.estado,
  reportadoPorId: row.reportado_por_id,
  creadoEn: row.creado_en,
  actualizadoEn: row.actualizado_en,
});

const findById = (id) => {
  const row = db.prepare('SELECT * FROM defectos WHERE id = ?').get(id);
  return row ? toApi(row) : null;
};

const list = (proyectoId, { estado, severidad } = {}) => {
  const clauses = ['proyecto_id = ?'];
  const params = [proyectoId];
  if (estado) {
    clauses.push('estado = ?');
    params.push(estado);
  }
  if (severidad) {
    clauses.push('severidad = ?');
    params.push(severidad);
  }
  const rows = db
    .prepare(`SELECT * FROM defectos WHERE ${clauses.join(' AND ')} ORDER BY creado_en DESC`)
    .all(...params);
  return rows.map(toApi);
};

const create = ({ proyectoId, ejecucionOrigenId = null, titulo, descripcion = null, severidad, reportadoPorId }) => {
  const id = newId();
  const timestamp = now();
  db.prepare(
    `INSERT INTO defectos (id, proyecto_id, ejecucion_origen_id, titulo, descripcion, severidad, estado, reportado_por_id, creado_en, actualizado_en)
     VALUES (?, ?, ?, ?, ?, ?, 'abierto', ?, ?, ?)`
  ).run(id, proyectoId, ejecucionOrigenId, titulo, descripcion, severidad, reportadoPorId, timestamp, timestamp);
  return findById(id);
};

const setEstado = (id, estado) => {
  db.prepare('UPDATE defectos SET estado = ?, actualizado_en = ? WHERE id = ?').run(estado, now(), id);
  return findById(id);
};

const listByEjecucion = (ejecucionId) =>
  db.prepare('SELECT * FROM defectos WHERE ejecucion_origen_id = ?').all(ejecucionId).map(toApi);

module.exports = { findById, list, create, setEstado, listByEjecucion };
