const db = require('../db/connection');
const { newId, now } = require('../utils/ids');

const toApiBase = (row) => ({
  id: row.id,
  cicloId: row.ciclo_id,
  casoId: row.caso_id,
  ejecutorId: row.ejecutor_id,
  estado: row.estado,
  fechaEjecucion: row.fecha_ejecucion,
  duracionSegundos: row.duracion_segundos,
  comentario: row.comentario,
  creadoEn: row.creado_en,
  actualizadoEn: row.actualizado_en,
});

const resultadosPasoDeEjecucion = (ejecucionId) =>
  db
    .prepare('SELECT * FROM resultados_paso WHERE ejecucion_id = ?')
    .all(ejecucionId)
    .map((r) => ({ id: r.id, ejecucionId: r.ejecucion_id, pasoId: r.paso_id, estado: r.estado, comentario: r.comentario }));

const defectoIdsDeEjecucion = (ejecucionId) =>
  db.prepare('SELECT id FROM defectos WHERE ejecucion_origen_id = ?').all(ejecucionId).map((r) => r.id);

const toApi = (row) => ({
  ...toApiBase(row),
  resultadosPaso: resultadosPasoDeEjecucion(row.id),
  defectoIds: defectoIdsDeEjecucion(row.id),
});

const findById = (id) => {
  const row = db.prepare('SELECT * FROM ejecuciones WHERE id = ?').get(id);
  return row ? toApi(row) : null;
};

const findRawById = (id) => db.prepare('SELECT * FROM ejecuciones WHERE id = ?').get(id);

const list = (cicloId, { estado, ejecutorId } = {}) => {
  const clauses = ['ciclo_id = ?'];
  const params = [cicloId];
  if (estado) {
    clauses.push('estado = ?');
    params.push(estado);
  }
  if (ejecutorId) {
    clauses.push('ejecutor_id = ?');
    params.push(ejecutorId);
  }
  const rows = db.prepare(`SELECT * FROM ejecuciones WHERE ${clauses.join(' AND ')}`).all(...params);
  return rows.map(toApi);
};

const listRawByCiclo = (cicloId) => db.prepare('SELECT * FROM ejecuciones WHERE ciclo_id = ?').all(cicloId);

const createBulk = (cicloId, casoIds) => {
  const insert = db.prepare(
    `INSERT INTO ejecuciones (id, ciclo_id, caso_id, estado, creado_en, actualizado_en)
     VALUES (?, ?, ?, 'pendiente', ?, ?)`
  );
  const timestamp = now();
  const ids = [];
  const tx = db.transaction(() => {
    for (const casoId of casoIds) {
      const id = newId();
      insert.run(id, cicloId, casoId, timestamp, timestamp);
      ids.push(id);
    }
  });
  tx();
  return ids.map(findById);
};

const tomar = (id, ejecutorId) => {
  db.prepare("UPDATE ejecuciones SET estado = 'en_progreso', ejecutor_id = ?, actualizado_en = ? WHERE id = ?").run(
    ejecutorId,
    now(),
    id
  );
  return findById(id);
};

const cerrarResultado = (id, { estado, comentario = null, duracionSegundos = null, resultadosPaso = [] }) => {
  const timestamp = now();
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE ejecuciones SET estado = ?, comentario = ?, duracion_segundos = ?, fecha_ejecucion = ?, actualizado_en = ? WHERE id = ?`
    ).run(estado, comentario, duracionSegundos, timestamp, timestamp, id);
    db.prepare('DELETE FROM resultados_paso WHERE ejecucion_id = ?').run(id);
    const insert = db.prepare(
      'INSERT INTO resultados_paso (id, ejecucion_id, paso_id, estado, comentario) VALUES (?, ?, ?, ?, ?)'
    );
    for (const r of resultadosPaso) {
      insert.run(newId(), id, r.pasoId, r.estado, r.comentario || null);
    }
  });
  tx();
  return findById(id);
};

const reintentar = (id) => {
  db.prepare(
    "UPDATE ejecuciones SET estado = 'pendiente', fecha_ejecucion = NULL, duracion_segundos = NULL, actualizado_en = ? WHERE id = ?"
  ).run(now(), id);
  return findById(id);
};

const findProyectoId = (ejecucionId) => {
  const row = db
    .prepare(
      `SELECT s.proyecto_id AS proyectoId
       FROM ejecuciones e
       JOIN casos_prueba c ON c.id = e.caso_id
       JOIN suites s ON s.id = c.suite_id
       WHERE e.id = ?`
    )
    .get(ejecucionId);
  return row ? row.proyectoId : null;
};

module.exports = {
  findById,
  findRawById,
  list,
  listRawByCiclo,
  createBulk,
  tomar,
  cerrarResultado,
  reintentar,
  resultadosPasoDeEjecucion,
  findProyectoId,
};
