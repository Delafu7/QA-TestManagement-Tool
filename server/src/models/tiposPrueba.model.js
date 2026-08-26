const db = require('../db/connection');
const { newId, now } = require('../utils/ids');
const { TIPOS_DEFECTO } = require('../db/migrarTiposPrueba');

const toApi = (row) => ({
  id: row.id,
  proyectoId: row.proyecto_id,
  nombre: row.nombre,
  slug: row.slug,
  color: row.color,
  archivado: !!row.archivado,
  creadoEn: row.creado_en,
});

const findById = (id) => {
  const row = db.prepare('SELECT * FROM tipos_prueba WHERE id = ?').get(id);
  return row ? toApi(row) : null;
};

const findRawById = (id) => db.prepare('SELECT * FROM tipos_prueba WHERE id = ?').get(id);

const listByProyecto = (proyectoId) =>
  db.prepare('SELECT * FROM tipos_prueba WHERE proyecto_id = ? ORDER BY nombre').all(proyectoId).map(toApi);

const findBySlug = (proyectoId, slug) => {
  const row = db.prepare('SELECT * FROM tipos_prueba WHERE proyecto_id = ? AND slug = ?').get(proyectoId, slug);
  return row ? toApi(row) : null;
};

const create = ({ proyectoId, nombre, slug, color }) => {
  const id = newId();
  db.prepare(
    'INSERT INTO tipos_prueba (id, proyecto_id, nombre, slug, color, archivado, creado_en) VALUES (?, ?, ?, ?, ?, 0, ?)'
  ).run(id, proyectoId, nombre, slug, color, now());
  return findById(id);
};

const update = (id, fields) => {
  const current = findRawById(id);
  if (!current) return null;
  const nombre = fields.nombre ?? current.nombre;
  const color = fields.color ?? current.color;
  const slug = fields.slug ?? current.slug;
  db.prepare('UPDATE tipos_prueba SET nombre = ?, slug = ?, color = ? WHERE id = ?').run(nombre, slug, color, id);
  return findById(id);
};

const archivar = (id) => {
  db.prepare('UPDATE tipos_prueba SET archivado = 1 WHERE id = ?').run(id);
  return findById(id);
};

const sembrarPorDefecto = (proyectoId) => {
  const insert = db.prepare(
    'INSERT INTO tipos_prueba (id, proyecto_id, nombre, slug, color, archivado, creado_en) VALUES (?, ?, ?, ?, ?, 0, ?)'
  );
  const timestamp = now();
  const tx = db.transaction(() => {
    for (const t of TIPOS_DEFECTO) {
      insert.run(newId(), proyectoId, t.nombre, t.slug, t.color, timestamp);
    }
  });
  tx();
  return listByProyecto(proyectoId);
};

module.exports = { findById, findRawById, listByProyecto, findBySlug, create, update, archivar, sembrarPorDefecto };
