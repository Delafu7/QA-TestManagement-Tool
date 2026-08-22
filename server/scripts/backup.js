// Genera una copia de seguridad en caliente de la base de datos configurada
// (SQLITE_DB_PATH, o server/data/qa-tool.sqlite por defecto) usando la API de
// backup en caliente de better-sqlite3 (docs/design/08-decisiones.md §15): es
// segura de ejecutar con el servidor en marcha y con escrituras en curso,
// porque no copia el archivo .sqlite directamente.
//
// Uso: node scripts/backup.js <ruta-archivo-salida>
//
// Cualquier fallo se registra como línea NDJSON en los logs del servidor,
// igual que el resto de errores de aplicación (server/src/utils/logger.js).

const path = require('path');
const Database = require('better-sqlite3');
const logger = require('../src/utils/logger');

const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '../data/qa-tool.sqlite');
const outputPath = process.argv[2];

function finish(code) {
  // No llamamos a process.exit() explícitamente: pino/sonic-boom ya registran
  // un listener de 'exit' que vuelca de forma síncrona lo pendiente en el
  // destino NDJSON; forzar la salida aquí compite con ese volcado y puede
  // lanzar "sonic boom is not ready yet" en scripts de vida corta como este.
  process.exitCode = code;
}

if (!outputPath) {
  console.error('Uso: node scripts/backup.js <ruta-archivo-salida>');
  process.exitCode = 1;
  return;
}

async function main() {
  let db;
  try {
    db = new Database(dbPath, { readonly: true });
    await db.backup(outputPath);
    logger.info({
      tipo: 'evento_negocio',
      evento: 'backup_completado',
      origen: dbPath,
      destino: outputPath,
    });
    console.log(outputPath);
    finish(0);
  } catch (err) {
    logger.error({
      tipo: 'app_error',
      metodo: 'SCRIPT',
      ruta: 'scripts/backup.js',
      errorCode: 'BACKUP_FAILED',
      mensaje: err.message,
    });
    console.error('Backup fallido:', err.message);
    finish(1);
  } finally {
    if (db) db.close();
  }
}

main();
