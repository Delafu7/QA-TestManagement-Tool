const db = require('../db/connection');
const { newId, now } = require('../utils/ids');
const { parsePagination } = require('../utils/pagination');
const casoVersionesModel = require('./casoVersiones.model');

const toApiBase = (row) => ({
  id: row.id,
  suiteId: row.suite_id,
  titulo: row.titulo,
  descripcion: row.descripcion,
  precondiciones: row.precondiciones,
  prioridad: row.prioridad,
  tipo: row.tipo,
  estado: row.estado,
  autorId: row.autor_id,
  creadoEn: row.creado_en,
  actualizadoEn: row.actualizado_en,
});

const pasosDeCaso = (casoId) =>
  db
    .prepare('SELECT * FROM pasos WHERE caso_id = ? ORDER BY orden')
    .all(casoId)
    .map((p) => ({ id: p.id, casoId: p.caso_id, orden: p.orden, accion: p.accion, resultadoEsperado: p.resultado_esperado }));

const etiquetaIdsDeCaso = (casoId) =>
  db.prepare('SELECT etiqueta_id FROM caso_etiquetas WHERE caso_id = ?').all(casoId).map((r) => r.etiqueta_id);

const toApi = (row) => ({
  ...toApiBase(row),
  etiquetaIds: etiquetaIdsDeCaso(row.id),
  pasos: pasosDeCaso(row.id),
});

const findById = (id) => {
  const row = db.prepare('SELECT * FROM casos_prueba WHERE id = ?').get(id);
  return row ? toApi(row) : null;
};

const findRawById = (id) => db.prepare('SELECT * FROM casos_prueba WHERE id = ?').get(id);

const list = (suiteId, { estado, prioridad, tipo, etiqueta, page, pageSize } = {}) => {
  const clauses = ['suite_id = ?'];
  const params = [suiteId];
  if (estado) {
    clauses.push('estado = ?');
    params.push(estado);
  }
  if (prioridad) {
    clauses.push('prioridad = ?');
    params.push(prioridad);
  }
  if (tipo) {
    clauses.push('tipo = ?');
    params.push(tipo);
  }
  let join = '';
  if (etiqueta) {
    join = 'JOIN caso_etiquetas ce ON ce.caso_id = casos_prueba.id';
    clauses.push('ce.etiqueta_id = ?');
    params.push(etiqueta);
  }
  const where = clauses.join(' AND ');
  const { page: p, pageSize: ps, offset } = parsePagination({ page, pageSize });
  const total = db.prepare(`SELECT COUNT(*) AS n FROM casos_prueba ${join} WHERE ${where}`).get(...params).n;
  const rows = db
    .prepare(`SELECT casos_prueba.* FROM casos_prueba ${join} WHERE ${where} ORDER BY titulo LIMIT ? OFFSET ?`)
    .all(...params, ps, offset);
  return { data: rows.map(toApi), pagination: { page: p, pageSize: ps, total } };
};

const replacePasos = (casoId, pasos) => {
  db.prepare('DELETE FROM pasos WHERE caso_id = ?').run(casoId);
  const insert = db.prepare('INSERT INTO pasos (id, caso_id, orden, accion, resultado_esperado) VALUES (?, ?, ?, ?, ?)');
  for (const paso of pasos) {
    insert.run(newId(), casoId, paso.orden, paso.accion, paso.resultadoEsperado);
  }
};

const replaceEtiquetas = (casoId, etiquetaIds) => {
  db.prepare('DELETE FROM caso_etiquetas WHERE caso_id = ?').run(casoId);
  const insert = db.prepare('INSERT INTO caso_etiquetas (caso_id, etiqueta_id) VALUES (?, ?)');
  for (const etiquetaId of etiquetaIds) {
    insert.run(casoId, etiquetaId);
  }
};

const create = ({ suiteId, titulo, descripcion = null, precondiciones = null, prioridad, tipo, autorId, etiquetaIds = [], pasos }) => {
  const id = newId();
  const timestamp = now();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO casos_prueba (id, suite_id, titulo, descripcion, precondiciones, prioridad, tipo, estado, autor_id, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'borrador', ?, ?, ?)`
    ).run(id, suiteId, titulo, descripcion, precondiciones, prioridad, tipo, autorId, timestamp, timestamp);
    replacePasos(id, pasos);
    replaceEtiquetas(id, etiquetaIds);
  });
  tx();
  return findById(id);
};

const update = (id, fields, editadoPorId) => {
  const current = findRawById(id);
  if (!current) return null;
  const titulo = fields.titulo ?? current.titulo;
  const descripcion = fields.descripcion ?? current.descripcion;
  const precondiciones = fields.precondiciones ?? current.precondiciones;
  const prioridad = fields.prioridad ?? current.prioridad;
  const tipo = fields.tipo ?? current.tipo;
  const tx = db.transaction(() => {
    // Snapshot del estado ANTERIOR al PATCH, para el historial de cambios de casos.
    casoVersionesModel.crearSnapshot({
      casoId: id,
      titulo: current.titulo,
      descripcion: current.descripcion,
      precondiciones: current.precondiciones,
      prioridad: current.prioridad,
      tipo: current.tipo,
      pasos: pasosDeCaso(id),
      editadoPorId,
    });
    db.prepare(
      'UPDATE casos_prueba SET titulo = ?, descripcion = ?, precondiciones = ?, prioridad = ?, tipo = ?, actualizado_en = ? WHERE id = ?'
    ).run(titulo, descripcion, precondiciones, prioridad, tipo, now(), id);
    if (fields.pasos) replacePasos(id, fields.pasos);
    if (fields.etiquetaIds) replaceEtiquetas(id, fields.etiquetaIds);
  });
  tx();
  return findById(id);
};

const versiones = (id) => casoVersionesModel.listByCaso(id);

const setEstado = (id, estado) => {
  db.prepare('UPDATE casos_prueba SET estado = ?, actualizado_en = ? WHERE id = ?').run(estado, now(), id);
  return findById(id);
};

const remove = (id) => {
  // casos_prueba solo se elimina cuando no tiene ejecuciones históricas (comprobado en
  // el servicio), pero sí puede tener pasos y etiquetas propias que hay que borrar antes:
  // sin esto, la FK de `pasos`/`caso_etiquetas` hacia `casos_prueba` hace que el DELETE
  // falle siempre (todo caso válido tiene al menos un paso).
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM caso_etiquetas WHERE caso_id = ?').run(id);
    db.prepare('DELETE FROM pasos WHERE caso_id = ?').run(id);
    db.prepare('DELETE FROM casos_prueba WHERE id = ?').run(id);
  });
  tx();
};

const countEjecucionesHistoricas = (id) =>
  db.prepare('SELECT COUNT(*) AS n FROM ejecuciones WHERE caso_id = ?').get(id).n;

module.exports = {
  findById,
  findRawById,
  list,
  create,
  update,
  setEstado,
  remove,
  countEjecucionesHistoricas,
  pasosDeCaso,
  versiones,
};
