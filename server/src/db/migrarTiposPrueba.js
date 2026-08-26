const { newId, now } = require('../utils/ids');

const TIPOS_DEFECTO = [
  { slug: 'funcional', nombre: 'Funcional', color: '#4F46E5' },
  { slug: 'regresion', nombre: 'Regresión', color: '#0D9488' },
  { slug: 'humo', nombre: 'Humo', color: '#EA580C' },
  { slug: 'exploratorio', nombre: 'Exploratorio', color: '#7C3AED' },
  { slug: 'integracion', nombre: 'Integración', color: '#2563EB' },
  { slug: 'rendimiento', nombre: 'Rendimiento', color: '#DC2626' },
  { slug: 'usabilidad', nombre: 'Usabilidad', color: '#DB2777' },
  { slug: 'accesibilidad', nombre: 'Accesibilidad', color: '#059669' },
];

const anadirColumnaSiFalta = (db, tabla, columna, definicion) => {
  const columnas = db.prepare(`PRAGMA table_info(${tabla})`).all().map((c) => c.name);
  if (!columnas.includes(columna)) {
    db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
  }
};

const sembrarTiposPorDefecto = (db) => {
  const proyectosSinTipos = db
    .prepare('SELECT id FROM proyectos p WHERE NOT EXISTS (SELECT 1 FROM tipos_prueba t WHERE t.proyecto_id = p.id)')
    .all();
  if (proyectosSinTipos.length === 0) return;

  const insertTipo = db.prepare(
    'INSERT INTO tipos_prueba (id, proyecto_id, nombre, slug, color, archivado, creado_en) VALUES (?, ?, ?, ?, ?, 0, ?)'
  );
  const tx = db.transaction(() => {
    const timestamp = now();
    for (const { id: proyectoId } of proyectosSinTipos) {
      for (const t of TIPOS_DEFECTO) {
        insertTipo.run(newId(), proyectoId, t.nombre, t.slug, t.color, timestamp);
      }
    }
  });
  tx();
};

// Migración de "tipo de prueba" de campo suelto (`casos_prueba.tipo`, 4 valores fijos)
// a entidad gestionada por proyecto (`tipos_prueba`). Se ejecuta en cada arranque;
// cada paso comprueba su propia condición de "ya aplicado", así que es idempotente
// sobre una base ya migrada. Ningún valor de `tipo` se toca ni se pierde: esta
// migración solo añade columnas y enlaces nuevos.
const migrarTiposPrueba = (db) => {
  anadirColumnaSiFalta(db, 'casos_prueba', 'tipo_prueba_id', 'TEXT REFERENCES tipos_prueba(id)');
  anadirColumnaSiFalta(db, 'caso_versiones', 'tipo_prueba_id', 'TEXT REFERENCES tipos_prueba(id)');
  anadirColumnaSiFalta(db, 'ejecuciones', 'tipo_prueba_id', 'TEXT REFERENCES tipos_prueba(id)');
  anadirColumnaSiFalta(db, 'defectos', 'tipo_prueba_id', 'TEXT REFERENCES tipos_prueba(id)');

  // Estos índices no pueden vivir en schema.sql: en una base ya existente,
  // `CREATE TABLE IF NOT EXISTS` no añade la columna `tipo_prueba_id`, así que un
  // `CREATE INDEX` sobre ella ejecutado antes de las ALTER de arriba fallaría con
  // "no such column". Se crean aquí, después de garantizar que la columna existe.
  db.exec('CREATE INDEX IF NOT EXISTS idx_casos_tipo_prueba ON casos_prueba(tipo_prueba_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_ejecuciones_tipo_prueba ON ejecuciones(tipo_prueba_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_defectos_tipo_prueba ON defectos(tipo_prueba_id)');

  sembrarTiposPorDefecto(db);

  // Enlaza cada caso con el tipo_prueba cuyo slug coincide con su `tipo` legado,
  // dentro de su propio proyecto (vía suite).
  db.exec(`
    UPDATE casos_prueba
    SET tipo_prueba_id = (
      SELECT tp.id FROM tipos_prueba tp
      JOIN suites s ON s.proyecto_id = tp.proyecto_id
      WHERE s.id = casos_prueba.suite_id AND tp.slug = casos_prueba.tipo
    )
    WHERE tipo_prueba_id IS NULL
  `);

  // Igual para cada versión histórica, usando el `tipo` que esa versión tenía en su momento.
  db.exec(`
    UPDATE caso_versiones
    SET tipo_prueba_id = (
      SELECT tp.id FROM tipos_prueba tp
      JOIN casos_prueba c ON c.id = caso_versiones.caso_id
      JOIN suites s ON s.id = c.suite_id
      WHERE s.proyecto_id = tp.proyecto_id AND tp.slug = caso_versiones.tipo
    )
    WHERE tipo_prueba_id IS NULL
  `);

  // Las ejecuciones anteriores a esta migración nunca tomaron una foto del tipo:
  // se aproxima con el tipo actual del caso (mejor esfuerzo, documentado en
  // docs/DATA_MODEL.md — no existe forma de recuperar el tipo que tenía el caso
  // en el momento exacto de cada ejecución pasada).
  db.exec(`
    UPDATE ejecuciones
    SET tipo_prueba_id = (SELECT tipo_prueba_id FROM casos_prueba WHERE id = ejecuciones.caso_id)
    WHERE tipo_prueba_id IS NULL
  `);

  // Los defectos con ejecución de origen heredan su tipo; los standalone previos a
  // esta migración se quedan sin tipo en vez de inventar un valor que no existía.
  db.exec(`
    UPDATE defectos
    SET tipo_prueba_id = (SELECT tipo_prueba_id FROM ejecuciones WHERE id = defectos.ejecucion_origen_id)
    WHERE tipo_prueba_id IS NULL AND ejecucion_origen_id IS NOT NULL
  `);
};

module.exports = { migrarTiposPrueba, TIPOS_DEFECTO };
