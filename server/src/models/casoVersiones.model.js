const db = require('../db/connection');
const { newId, now } = require('../utils/ids');
const { parsePagination } = require('../utils/pagination');

const toApi = (row) => ({
  id: row.id,
  casoId: row.caso_id,
  version: row.version,
  titulo: row.titulo,
  descripcion: row.descripcion,
  precondiciones: row.precondiciones,
  prioridad: row.prioridad,
  tipo: row.tipo,
  tipoPruebaId: row.tipo_prueba_id,
  pasos: JSON.parse(row.pasos_json),
  editadoPorId: row.editado_por_id,
  creadoEn: row.creado_en,
});

// Guarda el estado del caso tal y como estaba justo ANTES de aplicarle el PATCH
// (snapshot "pre-imagen"). Se llama dentro de la misma transacción que
// casos.model.js#update, antes de escribir los nuevos valores.
const crearSnapshot = ({ casoId, titulo, descripcion, precondiciones, prioridad, tipo, tipoPruebaId, pasos, editadoPorId }) => {
  const siguienteVersion =
    (db.prepare('SELECT MAX(version) AS v FROM caso_versiones WHERE caso_id = ?').get(casoId).v || 0) + 1;
  db.prepare(
    `INSERT INTO caso_versiones (id, caso_id, version, titulo, descripcion, precondiciones, prioridad, tipo, tipo_prueba_id, pasos_json, editado_por_id, creado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    newId(),
    casoId,
    siguienteVersion,
    titulo,
    descripcion,
    precondiciones,
    prioridad,
    tipo,
    tipoPruebaId,
    JSON.stringify(pasos),
    editadoPorId,
    now()
  );
};

const listByCaso = (casoId) =>
  db.prepare('SELECT * FROM caso_versiones WHERE caso_id = ? ORDER BY version ASC').all(casoId).map(toApi);

// Casos distintos con al menos un cambio registrado en [desde, hasta], para el
// widget del dashboard. Se agrega en SQL sobre TODO el histórico de versiones,
// nunca sobre una página ya recortada por el cliente.
const modificadosEnPeriodo = (proyectoId, { desde, hasta, page, pageSize } = {}) => {
  const { page: p, pageSize: ps, offset } = parsePagination({ page, pageSize });
  const params = [proyectoId, desde, hasta];

  const total = db
    .prepare(
      `SELECT COUNT(*) AS n FROM (
         SELECT cv.caso_id
         FROM caso_versiones cv
         JOIN casos_prueba c ON c.id = cv.caso_id
         JOIN suites s ON s.id = c.suite_id
         WHERE s.proyecto_id = ? AND cv.creado_en >= ? AND cv.creado_en <= ?
         GROUP BY cv.caso_id
       )`
    )
    .get(...params).n;

  const rows = db
    .prepare(
      `SELECT cv.caso_id AS caso_id, c.titulo AS caso_titulo, s.nombre AS suite_nombre,
              COUNT(*) AS num_cambios, MAX(cv.creado_en) AS ultima_modificacion
       FROM caso_versiones cv
       JOIN casos_prueba c ON c.id = cv.caso_id
       JOIN suites s ON s.id = c.suite_id
       WHERE s.proyecto_id = ? AND cv.creado_en >= ? AND cv.creado_en <= ?
       GROUP BY cv.caso_id
       ORDER BY ultima_modificacion DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, ps, offset);

  const data = rows.map((r) => ({
    casoId: r.caso_id,
    casoTitulo: r.caso_titulo,
    suiteNombre: r.suite_nombre,
    numCambios: r.num_cambios,
    ultimaModificacion: r.ultima_modificacion,
  }));

  return { data, pagination: { page: p, pageSize: ps, total } };
};

module.exports = { crearSnapshot, listByCaso, modificadosEnPeriodo };
