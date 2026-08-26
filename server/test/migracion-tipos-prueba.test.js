const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

// Este archivo NO usa testServer/fixtures: necesita construir a mano una base de
// datos que representa el estado ANTES de esta migración (sin `tipos_prueba` ni
// columnas `tipo_prueba_id`), para comprobar que `db/connection.js` la migra
// correctamente al arrancar sobre un fichero ya existente.
const dbPath = path.join(os.tmpdir(), `qa-tool-migracion-test-${process.pid}.sqlite`);
process.env.SQLITE_DB_PATH = dbPath;
process.env.LOG_FILE_PATH = path.join(os.tmpdir(), `qa-tool-migracion-test-${process.pid}.ndjson`);

test.before(() => {
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  const legacyDb = new Database(dbPath);
  legacyDb.pragma('foreign_keys = ON');
  legacyDb.exec(`
    CREATE TABLE usuarios (
      id TEXT PRIMARY KEY, nombre TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      rol TEXT NOT NULL, avatar_url TEXT, activo INTEGER NOT NULL DEFAULT 1, creado_en TEXT NOT NULL
    );
    CREATE TABLE proyectos (
      id TEXT PRIMARY KEY, nombre TEXT NOT NULL, descripcion TEXT,
      propietario_id TEXT NOT NULL REFERENCES usuarios(id), estado TEXT NOT NULL DEFAULT 'activo',
      creado_en TEXT NOT NULL, actualizado_en TEXT NOT NULL
    );
    CREATE TABLE suites (
      id TEXT PRIMARY KEY, proyecto_id TEXT NOT NULL REFERENCES proyectos(id), suite_padre_id TEXT,
      nombre TEXT NOT NULL, descripcion TEXT, creado_en TEXT NOT NULL, actualizado_en TEXT NOT NULL
    );
    CREATE TABLE casos_prueba (
      id TEXT PRIMARY KEY, suite_id TEXT NOT NULL REFERENCES suites(id), titulo TEXT NOT NULL,
      descripcion TEXT, precondiciones TEXT, prioridad TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('funcional', 'regresion', 'humo', 'exploratorio')),
      estado TEXT NOT NULL DEFAULT 'borrador', autor_id TEXT NOT NULL REFERENCES usuarios(id),
      creado_en TEXT NOT NULL, actualizado_en TEXT NOT NULL
    );
    CREATE TABLE caso_versiones (
      id TEXT PRIMARY KEY, caso_id TEXT NOT NULL REFERENCES casos_prueba(id), version INTEGER NOT NULL,
      titulo TEXT NOT NULL, descripcion TEXT, precondiciones TEXT, prioridad TEXT NOT NULL, tipo TEXT NOT NULL,
      pasos_json TEXT NOT NULL, editado_por_id TEXT NOT NULL REFERENCES usuarios(id), creado_en TEXT NOT NULL
    );
    CREATE TABLE pasos (
      id TEXT PRIMARY KEY, caso_id TEXT NOT NULL REFERENCES casos_prueba(id), orden INTEGER NOT NULL,
      accion TEXT NOT NULL, resultado_esperado TEXT NOT NULL
    );
    CREATE TABLE ciclos (
      id TEXT PRIMARY KEY, proyecto_id TEXT NOT NULL REFERENCES proyectos(id), nombre TEXT NOT NULL,
      descripcion TEXT, estado TEXT NOT NULL DEFAULT 'planificada', fecha_inicio TEXT NOT NULL,
      fecha_fin_prevista TEXT NOT NULL, fecha_fin_real TEXT, responsable_id TEXT NOT NULL REFERENCES usuarios(id),
      creado_en TEXT NOT NULL, actualizado_en TEXT NOT NULL
    );
    CREATE TABLE ejecuciones (
      id TEXT PRIMARY KEY, ciclo_id TEXT NOT NULL REFERENCES ciclos(id), caso_id TEXT NOT NULL REFERENCES casos_prueba(id),
      ejecutor_id TEXT REFERENCES usuarios(id), estado TEXT NOT NULL DEFAULT 'pendiente',
      fecha_ejecucion TEXT, duracion_segundos INTEGER, comentario TEXT,
      creado_en TEXT NOT NULL, actualizado_en TEXT NOT NULL
    );
    CREATE TABLE resultados_paso (
      id TEXT PRIMARY KEY, ejecucion_id TEXT NOT NULL REFERENCES ejecuciones(id), paso_id TEXT NOT NULL REFERENCES pasos(id),
      estado TEXT NOT NULL, comentario TEXT
    );
    CREATE TABLE defectos (
      id TEXT PRIMARY KEY, proyecto_id TEXT NOT NULL REFERENCES proyectos(id), ejecucion_origen_id TEXT REFERENCES ejecuciones(id),
      titulo TEXT NOT NULL, descripcion TEXT, severidad TEXT NOT NULL, estado TEXT NOT NULL DEFAULT 'abierto',
      reportado_por_id TEXT NOT NULL REFERENCES usuarios(id), creado_en TEXT NOT NULL, actualizado_en TEXT NOT NULL
    );
  `);

  const now = () => new Date().toISOString();
  legacyDb.prepare('INSERT INTO usuarios (id, nombre, email, rol, activo, creado_en) VALUES (?, ?, ?, ?, 1, ?)').run('u-1', 'Ana', 'ana@example.com', 'qa', now());
  legacyDb.prepare('INSERT INTO proyectos (id, nombre, propietario_id, estado, creado_en, actualizado_en) VALUES (?, ?, ?, ?, ?, ?)').run('p-1', 'Proyecto legado', 'u-1', 'activo', now(), now());
  legacyDb.prepare('INSERT INTO suites (id, proyecto_id, nombre, creado_en, actualizado_en) VALUES (?, ?, ?, ?, ?)').run('s-1', 'p-1', 'Suite legada', now(), now());
  legacyDb.prepare(
    `INSERT INTO casos_prueba (id, suite_id, titulo, prioridad, tipo, estado, autor_id, creado_en, actualizado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('c-1', 's-1', 'Caso legado', 'alta', 'humo', 'activo', 'u-1', now(), now());
  legacyDb.prepare(
    `INSERT INTO caso_versiones (id, caso_id, version, titulo, prioridad, tipo, pasos_json, editado_por_id, creado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('cv-1', 'c-1', 1, 'Caso legado v1', 'alta', 'exploratorio', '[]', 'u-1', now());
  legacyDb.prepare(
    `INSERT INTO ciclos (id, proyecto_id, nombre, fecha_inicio, fecha_fin_prevista, responsable_id, creado_en, actualizado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('ci-1', 'p-1', 'Ciclo legado', '2026-01-01', '2026-01-31', 'u-1', now(), now());
  legacyDb.prepare(
    `INSERT INTO ejecuciones (id, ciclo_id, caso_id, estado, creado_en, actualizado_en) VALUES (?, ?, ?, ?, ?, ?)`
  ).run('e-1', 'ci-1', 'c-1', 'failed', now(), now());
  legacyDb.prepare(
    `INSERT INTO defectos (id, proyecto_id, ejecucion_origen_id, titulo, severidad, estado, reportado_por_id, creado_en, actualizado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('d-1', 'p-1', 'e-1', 'Defecto de la ejecución', 'alta', 'abierto', 'u-1', now(), now());
  legacyDb.prepare(
    `INSERT INTO defectos (id, proyecto_id, ejecucion_origen_id, titulo, severidad, estado, reportado_por_id, creado_en, actualizado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('d-2', 'p-1', null, 'Defecto standalone previo a la migración', 'baja', 'abierto', 'u-1', now(), now());
  legacyDb.close();
});

test.after(() => {
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
});

test('la migración añade tipo_prueba_id sin tocar el valor de `tipo` legado', () => {
  const db = require('../src/db/connection');

  const caso = db.prepare('SELECT * FROM casos_prueba WHERE id = ?').get('c-1');
  assert.equal(caso.tipo, 'humo'); // no se pierde el valor original
  assert.ok(caso.tipo_prueba_id, 'el caso debe quedar enlazado a un tipo_prueba');

  const tipoPrueba = db.prepare('SELECT * FROM tipos_prueba WHERE id = ?').get(caso.tipo_prueba_id);
  assert.equal(tipoPrueba.slug, 'humo');
  assert.equal(tipoPrueba.proyecto_id, 'p-1');
});

test('la migración siembra los 8 tipos por defecto para cada proyecto existente', () => {
  const db = require('../src/db/connection');
  const tipos = db.prepare('SELECT slug FROM tipos_prueba WHERE proyecto_id = ?').all('p-1').map((r) => r.slug);
  assert.equal(tipos.length, 8);
  ['funcional', 'regresion', 'humo', 'exploratorio', 'integracion', 'rendimiento', 'usabilidad', 'accesibilidad'].forEach((slug) => {
    assert.ok(tipos.includes(slug), `falta el tipo por defecto '${slug}'`);
  });
});

test('la migración enlaza cada versión histórica con el tipo que tenía en su momento, no el actual del caso', () => {
  const db = require('../src/db/connection');
  const version = db.prepare('SELECT * FROM caso_versiones WHERE id = ?').get('cv-1');
  const tipoPrueba = db.prepare('SELECT * FROM tipos_prueba WHERE id = ?').get(version.tipo_prueba_id);
  assert.equal(tipoPrueba.slug, 'exploratorio');
});

test('la migración aproxima el tipo de ejecuciones previas con el tipo actual del caso', () => {
  const db = require('../src/db/connection');
  const ejecucion = db.prepare('SELECT * FROM ejecuciones WHERE id = ?').get('e-1');
  const caso = db.prepare('SELECT * FROM casos_prueba WHERE id = ?').get('c-1');
  assert.equal(ejecucion.tipo_prueba_id, caso.tipo_prueba_id);
});

test('la migración hereda el tipo en defectos con ejecución de origen, y deja sin tipo los standalone previos', () => {
  const db = require('../src/db/connection');
  const defectoConOrigen = db.prepare('SELECT * FROM defectos WHERE id = ?').get('d-1');
  const ejecucion = db.prepare('SELECT * FROM ejecuciones WHERE id = ?').get('e-1');
  assert.equal(defectoConOrigen.tipo_prueba_id, ejecucion.tipo_prueba_id);

  const defectoStandalone = db.prepare('SELECT * FROM defectos WHERE id = ?').get('d-2');
  assert.equal(defectoStandalone.tipo_prueba_id, null);
});

test('la migración es idempotente: reaplicarla no duplica tipos ni cambia enlaces ya resueltos', () => {
  const { migrarTiposPrueba } = require('../src/db/migrarTiposPrueba');
  const db = require('../src/db/connection');
  const antes = db.prepare('SELECT COUNT(*) AS n FROM tipos_prueba WHERE proyecto_id = ?').get('p-1').n;
  const casoAntes = db.prepare('SELECT tipo_prueba_id FROM casos_prueba WHERE id = ?').get('c-1').tipo_prueba_id;

  migrarTiposPrueba(db);

  const despues = db.prepare('SELECT COUNT(*) AS n FROM tipos_prueba WHERE proyecto_id = ?').get('p-1').n;
  const casoDespues = db.prepare('SELECT tipo_prueba_id FROM casos_prueba WHERE id = ?').get('c-1').tipo_prueba_id;
  assert.equal(despues, antes);
  assert.equal(casoDespues, casoAntes);
});
