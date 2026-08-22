const db = require('../db/connection');
const { newId, now } = require('../utils/ids');
const { parsePagination } = require('../utils/pagination');

const toApi = (row) => ({
  id: row.id,
  nombre: row.nombre,
  email: row.email,
  rol: row.rol,
  avatarUrl: row.avatar_url,
  activo: !!row.activo,
  creadoEn: row.creado_en,
});

const findById = (id) => {
  const row = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
  return row ? toApi(row) : null;
};

const findByEmail = (email) => db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);

const list = ({ rol, page, pageSize } = {}) => {
  const clauses = [];
  const params = [];
  if (rol) {
    clauses.push('rol = ?');
    params.push(rol);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { page: p, pageSize: ps, offset } = parsePagination({ page, pageSize });
  const total = db.prepare(`SELECT COUNT(*) AS n FROM usuarios ${where}`).get(...params).n;
  const rows = db
    .prepare(`SELECT * FROM usuarios ${where} ORDER BY nombre LIMIT ? OFFSET ?`)
    .all(...params, ps, offset);
  return { data: rows.map(toApi), pagination: { page: p, pageSize: ps, total } };
};

const create = ({ nombre, email, rol, avatarUrl = null }) => {
  const id = newId();
  const creadoEn = now();
  db.prepare(
    'INSERT INTO usuarios (id, nombre, email, rol, avatar_url, activo, creado_en) VALUES (?, ?, ?, ?, ?, 1, ?)'
  ).run(id, nombre, email, rol, avatarUrl, creadoEn);
  return findById(id);
};

const update = (id, fields) => {
  const current = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
  if (!current) return null;
  const nombre = fields.nombre ?? current.nombre;
  const rol = fields.rol ?? current.rol;
  const activo = fields.activo ?? !!current.activo;
  db.prepare('UPDATE usuarios SET nombre = ?, rol = ?, activo = ? WHERE id = ?').run(
    nombre,
    rol,
    activo ? 1 : 0,
    id
  );
  return findById(id);
};

module.exports = { findById, findByEmail, list, create, update };
