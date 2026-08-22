const db = require('../db/connection');
const { newId, now } = require('../utils/ids');
const { parsePagination } = require('../utils/pagination');

const toApi = (row) => ({
  id: row.id,
  proyectoId: row.proyecto_id,
  nombre: row.nombre,
  descripcion: row.descripcion,
  estado: row.estado,
  fechaInicio: row.fecha_inicio,
  fechaFinPrevista: row.fecha_fin_prevista,
  fechaFinReal: row.fecha_fin_real,
  responsableId: row.responsable_id,
  comentario: row.comentario,
  creadoEn: row.creado_en,
  actualizadoEn: row.actualizado_en,
});

const findById = (id) => {
  const row = db.prepare('SELECT * FROM ciclos WHERE id = ?').get(id);
  return row ? toApi(row) : null;
};

const list = (proyectoId, { estado, page, pageSize } = {}) => {
  const clauses = ['proyecto_id = ?'];
  const params = [proyectoId];
  if (estado) {
    clauses.push('estado = ?');
    params.push(estado);
  }
  const where = clauses.join(' AND ');
  const { page: p, pageSize: ps, offset } = parsePagination({ page, pageSize });
  const total = db.prepare(`SELECT COUNT(*) AS n FROM ciclos WHERE ${where}`).get(...params).n;
  const rows = db
    .prepare(`SELECT * FROM ciclos WHERE ${where} ORDER BY fecha_inicio DESC LIMIT ? OFFSET ?`)
    .all(...params, ps, offset);
  return { data: rows.map(toApi), pagination: { page: p, pageSize: ps, total } };
};

const create = ({ proyectoId, nombre, descripcion = null, fechaInicio, fechaFinPrevista, responsableId }) => {
  const id = newId();
  const timestamp = now();
  db.prepare(
    `INSERT INTO ciclos (id, proyecto_id, nombre, descripcion, estado, fecha_inicio, fecha_fin_prevista, responsable_id, creado_en, actualizado_en)
     VALUES (?, ?, ?, ?, 'planificada', ?, ?, ?, ?, ?)`
  ).run(id, proyectoId, nombre, descripcion, fechaInicio, fechaFinPrevista, responsableId, timestamp, timestamp);
  return findById(id);
};

const setEstado = (id, estado, { fechaFinReal, comentario } = {}) => {
  const sets = ['estado = ?', 'actualizado_en = ?'];
  const params = [estado, now()];
  if (fechaFinReal !== undefined) {
    sets.push('fecha_fin_real = ?');
    params.push(fechaFinReal);
  }
  if (comentario !== undefined) {
    sets.push('comentario = ?');
    params.push(comentario);
  }
  params.push(id);
  db.prepare(`UPDATE ciclos SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return findById(id);
};

const metricas = (id) => {
  const counts = db
    .prepare('SELECT estado, COUNT(*) AS n FROM ejecuciones WHERE ciclo_id = ? GROUP BY estado')
    .all(id)
    .reduce((acc, r) => ({ ...acc, [r.estado]: r.n }), {});
  const passed = counts.passed || 0;
  const failed = counts.failed || 0;
  const blocked = counts.blocked || 0;
  const skipped = counts.skipped || 0;
  const pendiente = (counts.pendiente || 0) + (counts.en_progreso || 0);
  const totalCasos = passed + failed + blocked + skipped + pendiente;
  const tasaAvance = totalCasos > 0 ? (passed + failed + blocked + skipped) / totalCasos : 0;
  const tasaExito = passed + failed > 0 ? passed / (passed + failed) : null;
  return { totalCasos, passed, failed, blocked, skipped, pendiente, tasaAvance, tasaExito };
};

// Cobertura por suite dentro de este ciclo, para las tarjetas del gestor
// (04-ui-ux.md §4): % de casos activos de cada suite que tienen al menos una
// ejecución registrada en este ciclo. Agregado en SQL sobre todo el ciclo, no
// sobre una página de casos ya recortada por el cliente.
const coberturaPorSuite = (cicloId) =>
  db
    .prepare(
      `SELECT s.id AS suite_id, s.nombre AS suite_nombre,
              COUNT(DISTINCT CASE WHEN c.estado = 'activo' THEN c.id END) AS total_casos,
              COUNT(DISTINCT CASE WHEN c.estado = 'activo' AND e.id IS NOT NULL THEN c.id END) AS casos_cubiertos
       FROM suites s
       JOIN casos_prueba c ON c.suite_id = s.id
       LEFT JOIN ejecuciones e ON e.caso_id = c.id AND e.ciclo_id = ?
       WHERE s.proyecto_id = (SELECT proyecto_id FROM ciclos WHERE id = ?)
       GROUP BY s.id
       ORDER BY s.nombre`
    )
    .all(cicloId, cicloId)
    .map((r) => ({
      suiteId: r.suite_id,
      suiteNombre: r.suite_nombre,
      totalCasos: r.total_casos,
      casosCubiertos: r.casos_cubiertos,
      pctCobertura: r.total_casos > 0 ? Math.round((r.casos_cubiertos / r.total_casos) * 1000) / 10 : null,
    }));

const findActivo = (proyectoId) => {
  const row = db
    .prepare("SELECT * FROM ciclos WHERE proyecto_id = ? AND estado = 'en_progreso' ORDER BY fecha_inicio DESC LIMIT 1")
    .get(proyectoId);
  return row ? toApi(row) : null;
};

module.exports = { findById, list, create, setEstado, metricas, findActivo, coberturaPorSuite };
