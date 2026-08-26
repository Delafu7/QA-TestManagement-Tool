const db = require('../db/connection');
const { newId, now } = require('../utils/ids');
const { parsePagination } = require('../utils/pagination');

const toApi = (row) => ({
  id: row.id,
  proyectoId: row.proyecto_id,
  cicloId: row.ciclo_id,
  tipoPruebaId: row.tipo_prueba_id,
  directorioRelativo: row.directorio_relativo,
  comando: row.comando,
  argumentos: JSON.parse(row.argumentos),
  estado: row.estado,
  codigoSalida: row.codigo_salida,
  salida: row.salida,
  salidaTruncada: !!row.salida_truncada,
  iniciadoEn: row.iniciado_en,
  finalizadoEn: row.finalizado_en,
  iniciadoPorId: row.iniciado_por_id,
});

const findById = (id) => {
  const row = db.prepare('SELECT * FROM runner_runs WHERE id = ?').get(id);
  return row ? toApi(row) : null;
};

const create = ({ proyectoId, cicloId, tipoPruebaId, directorioRelativo, comando, argumentos, iniciadoPorId }) => {
  const id = newId();
  db.prepare(
    `INSERT INTO runner_runs
       (id, proyecto_id, ciclo_id, tipo_prueba_id, directorio_relativo, comando, argumentos, estado, iniciado_en, iniciado_por_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'en_progreso', ?, ?)`
  ).run(id, proyectoId, cicloId || null, tipoPruebaId || null, directorioRelativo, comando, JSON.stringify(argumentos), now(), iniciadoPorId);
  return findById(id);
};

const finalizar = (id, { estado, codigoSalida, salida, salidaTruncada }) => {
  db.prepare(
    `UPDATE runner_runs
     SET estado = ?, codigo_salida = ?, salida = ?, salida_truncada = ?, finalizado_en = ?
     WHERE id = ?`
  ).run(estado, codigoSalida, salida, salidaTruncada ? 1 : 0, now(), id);
  return findById(id);
};

const list = ({ proyectoId, cicloId, tipoPruebaId, page, pageSize } = {}) => {
  const clauses = [];
  const params = [];
  if (proyectoId) {
    clauses.push('proyecto_id = ?');
    params.push(proyectoId);
  }
  if (cicloId) {
    clauses.push('ciclo_id = ?');
    params.push(cicloId);
  }
  if (tipoPruebaId) {
    clauses.push('tipo_prueba_id = ?');
    params.push(tipoPruebaId);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { page: p, pageSize: ps, offset } = parsePagination({ page, pageSize });
  const total = db.prepare(`SELECT COUNT(*) AS n FROM runner_runs ${where}`).get(...params).n;
  const rows = db
    .prepare(`SELECT * FROM runner_runs ${where} ORDER BY iniciado_en DESC LIMIT ? OFFSET ?`)
    .all(...params, ps, offset);
  return { data: rows.map(toApi), pagination: { page: p, pageSize: ps, total } };
};

module.exports = { findById, create, finalizar, list };
