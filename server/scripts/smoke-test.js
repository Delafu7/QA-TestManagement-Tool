const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-tool-smoke-'));
process.env.SQLITE_DB_PATH = path.join(tmpDir, 'qa-tool.sqlite');
process.env.LOG_FILE_PATH = path.join(tmpDir, 'server.ndjson');
process.env.PORT = process.env.PORT || '4100';

const app = require('../src/app');

async function main() {
  const server = app.listen(process.env.PORT);
  const base = `http://localhost:${process.env.PORT}`;

  try {
    const health = await fetch(`${base}/health`);
    if (health.status !== 200) throw new Error(`GET /health devolvió ${health.status}`);
    const healthBody = await health.json();
    if (healthBody.status !== 'ok') throw new Error(`GET /health respondió ${JSON.stringify(healthBody)}`);

    const usuario = await fetch(`${base}/api/usuarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'CI Smoke Test', email: 'ci-smoke@example.com', rol: 'qa' }),
    });
    if (usuario.status !== 201) throw new Error(`POST /api/usuarios devolvió ${usuario.status}`);

    const usuarioSinAuth = await fetch(`${base}/api/proyectos`);
    if (usuarioSinAuth.status !== 401) throw new Error(`GET /api/proyectos sin X-User-Id debería dar 401, dio ${usuarioSinAuth.status}`);

    console.log('smoke test OK: /health, POST /api/usuarios y autenticación mínima responden correctamente');
  } finally {
    server.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('smoke test FALLÓ:', err.message);
  process.exit(1);
});
