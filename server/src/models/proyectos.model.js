const db = require('../db/connection');
const { newId, now } = require('../utils/ids');
const { parsePagination } = require('../utils/pagination');

const toApi = (row) => ({
  id: row.id,
  nombre: row.nombre,
  descripcion: row.descripcion,
  propietarioId: row.propietario_id,
  estado: row.estado,
  creadoEn: row.creado_en,
  actualizadoEn: row.actualizado_en,
});

const findById = (id) => {
  const row = db.prepare('SELECT * FROM proyectos WHERE id = ?').get(id);
  return row ? toApi(row) : null;
};

const list = ({ estado, page, pageSize } = {}) => {
  const clauses = [];
  const params = [];
  if (estado) {
    clauses.push('estado = ?');
    params.push(estado);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { page: p, pageSize: ps, offset } = parsePagination({ page, pageSize });
  const total = db.prepare(`SELECT COUNT(*) AS n FROM proyectos ${where}`).get(...params).n;
  const rows = db
    .prepare(`SELECT * FROM proyectos ${where} ORDER BY nombre LIMIT ? OFFSET ?`)
    .all(...params, ps, offset);
  return { data: rows.map(toApi), pagination: { page: p, pageSize: ps, total } };
};

const create = ({ nombre, descripcion = null, propietarioId }) => {
  const id = newId();
  const timestamp = now();
  db.prepare(
    'INSERT INTO proyectos (id, nombre, descripcion, propietario_id, estado, creado_en, actualizado_en) VALUES (?, ?, ?, ?, \'activo\', ?, ?)'
  ).run(id, nombre, descripcion, propietarioId, timestamp, timestamp);
  return findById(id);
};

const update = (id, fields) => {
  const current = db.prepare('SELECT * FROM proyectos WHERE id = ?').get(id);
  if (!current) return null;
  const nombre = fields.nombre ?? current.nombre;
  const descripcion = fields.descripcion ?? current.descripcion;
  db.prepare('UPDATE proyectos SET nombre = ?, descripcion = ?, actualizado_en = ? WHERE id = ?').run(
    nombre,
    descripcion,
    now(),
    id
  );
  return findById(id);
};

const setEstado = (id, estado) => {
  db.prepare('UPDATE proyectos SET estado = ?, actualizado_en = ? WHERE id = ?').run(estado, now(), id);
  return findById(id);
};

const metricasResumen = (id) => {
  const totalSuites = db.prepare('SELECT COUNT(*) AS n FROM suites WHERE proyecto_id = ?').get(id).n;
  const totalCasos = db
    .prepare(
      `SELECT COUNT(*) AS n FROM casos_prueba c JOIN suites s ON c.suite_id = s.id WHERE s.proyecto_id = ?`
    )
    .get(id).n;
  const ciclosActivos = db
    .prepare(
      `SELECT COUNT(*) AS n FROM ciclos WHERE proyecto_id = ? AND estado IN ('planificada', 'en_progreso', 'bloqueada')`
    )
    .get(id).n;
  return { totalSuites, totalCasos, ciclosActivos };
};

module.exports = { findById, list, create, update, setEstado, metricasResumen };
