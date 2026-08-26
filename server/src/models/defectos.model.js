const db = require('../db/connection');
const { newId, now } = require('../utils/ids');
const { parsePagination } = require('../utils/pagination');

const toApi = (row) => ({
  id: row.id,
  proyectoId: row.proyecto_id,
  ejecucionOrigenId: row.ejecucion_origen_id,
  tipoPruebaId: row.tipo_prueba_id,
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

const list = (proyectoId, { estado, severidad, tipoPruebaId, page, pageSize } = {}) => {
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
  if (tipoPruebaId) {
    clauses.push('tipo_prueba_id = ?');
    params.push(tipoPruebaId);
  }
  const where = clauses.join(' AND ');
  const { page: p, pageSize: ps, offset } = parsePagination({ page, pageSize });
  const total = db.prepare(`SELECT COUNT(*) AS n FROM defectos WHERE ${where}`).get(...params).n;
  const rows = db
    .prepare(`SELECT * FROM defectos WHERE ${where} ORDER BY creado_en DESC LIMIT ? OFFSET ?`)
    .all(...params, ps, offset);
  return { data: rows.map(toApi), pagination: { page: p, pageSize: ps, total } };
};

const create = ({ proyectoId, ejecucionOrigenId = null, tipoPruebaId = null, titulo, descripcion = null, severidad, reportadoPorId }) => {
  const id = newId();
  const timestamp = now();
  db.prepare(
    `INSERT INTO defectos (id, proyecto_id, ejecucion_origen_id, tipo_prueba_id, titulo, descripcion, severidad, estado, reportado_por_id, creado_en, actualizado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'abierto', ?, ?, ?)`
  ).run(id, proyectoId, ejecucionOrigenId, tipoPruebaId, titulo, descripcion, severidad, reportadoPorId, timestamp, timestamp);
  return findById(id);
};

const setEstado = (id, estado) => {
  db.prepare('UPDATE defectos SET estado = ?, actualizado_en = ? WHERE id = ?').run(estado, now(), id);
  return findById(id);
};

const listByEjecucion = (ejecucionId) =>
  db.prepare('SELECT * FROM defectos WHERE ejecucion_origen_id = ?').all(ejecucionId).map(toApi);

module.exports = { findById, list, create, setEstado, listByEjecucion };
