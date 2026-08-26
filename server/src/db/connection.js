const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { migrarTiposPrueba } = require('./migrarTiposPrueba');

const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '../../data/qa-tool.sqlite');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Migración manual mínima (08-decisiones.md §9): CREATE TABLE IF NOT EXISTS no añade
// columnas a una tabla ya existente, así que las bases de datos creadas antes de este
// campo necesitan este paso explícito.
const ciclosColumns = db.prepare('PRAGMA table_info(ciclos)').all().map((c) => c.name);
if (!ciclosColumns.includes('comentario')) {
  db.exec('ALTER TABLE ciclos ADD COLUMN comentario TEXT');
}

migrarTiposPrueba(db);

module.exports = db;
