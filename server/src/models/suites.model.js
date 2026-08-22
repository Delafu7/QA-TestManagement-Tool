const db = require('../db/connection');
const { newId, now } = require('../utils/ids');

const toApi = (row) => ({
  id: row.id,
  proyectoId: row.proyecto_id,
  suitePadreId: row.suite_padre_id,
  nombre: row.nombre,
  descripcion: row.descripcion,
  creadoEn: row.creado_en,
  actualizadoEn: row.actualizado_en,
});

const findById = (id) => {
  const row = db.prepare('SELECT * FROM suites WHERE id = ?').get(id);
  return row ? toApi(row) : null;
};

const listByProyecto = (proyectoId) =>
  db.prepare('SELECT * FROM suites WHERE proyecto_id = ? ORDER BY nombre').all(proyectoId).map(toApi);

const buildTree = (proyectoId) => {
  const suites = listByProyecto(proyectoId);
  const byId = new Map(suites.map((s) => [s.id, { ...s, hijas: [] }]));
  const roots = [];
  for (const suite of byId.values()) {
    if (suite.suitePadreId && byId.has(suite.suitePadreId)) {
      byId.get(suite.suitePadreId).hijas.push(suite);
    } else {
      roots.push(suite);
    }
  }
  return roots;
};

const create = ({ proyectoId, suitePadreId = null, nombre, descripcion = null }) => {
  const id = newId();
  const timestamp = now();
  db.prepare(
    'INSERT INTO suites (id, proyecto_id, suite_padre_id, nombre, descripcion, creado_en, actualizado_en) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, proyectoId, suitePadreId, nombre, descripcion, timestamp, timestamp);
  return findById(id);
};

const update = (id, fields) => {
  const current = db.prepare('SELECT * FROM suites WHERE id = ?').get(id);
  if (!current) return null;
  const nombre = fields.nombre ?? current.nombre;
  const descripcion = fields.descripcion ?? current.descripcion;
  const suitePadreId = fields.suitePadreId !== undefined ? fields.suitePadreId : current.suite_padre_id;
  db.prepare(
    'UPDATE suites SET nombre = ?, descripcion = ?, suite_padre_id = ?, actualizado_en = ? WHERE id = ?'
  ).run(nombre, descripcion, suitePadreId, now(), id);
  return findById(id);
};

const remove = (id) => db.prepare('DELETE FROM suites WHERE id = ?').run(id);

const countCasosActivos = (id) =>
  db.prepare("SELECT COUNT(*) AS n FROM casos_prueba WHERE suite_id = ? AND estado = 'activo'").get(id).n;

const countCasos = (id) => db.prepare('SELECT COUNT(*) AS n FROM casos_prueba WHERE suite_id = ?').get(id).n;

const countHijas = (id) => db.prepare('SELECT COUNT(*) AS n FROM suites WHERE suite_padre_id = ?').get(id).n;

const cobertura = (suiteId, cicloActualId = null) => {
  const totalActivos = countCasosActivos(suiteId);
  if (totalActivos === 0) return null;
  if (!cicloActualId) return { totalActivos, conEjecucion: 0, ratio: 0 };
  const conEjecucion = db
    .prepare(
      `SELECT COUNT(DISTINCT c.id) AS n
       FROM casos_prueba c
       JOIN ejecuciones e ON e.caso_id = c.id AND e.ciclo_id = ?
       WHERE c.suite_id = ? AND c.estado = 'activo'`
    )
    .get(cicloActualId, suiteId).n;
  return { totalActivos, conEjecucion, ratio: conEjecucion / totalActivos };
};

module.exports = {
  findById,
  listByProyecto,
  buildTree,
  create,
  update,
  remove,
  countCasosActivos,
  countCasos,
  countHijas,
  cobertura,
};
