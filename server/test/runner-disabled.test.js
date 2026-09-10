const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const os = require('os');

process.env.SQLITE_DB_PATH = ':memory:';
process.env.LOG_FILE_PATH = path.join(os.tmpdir(), `qa-tool-test-${process.pid}.ndjson`);
delete process.env.RUNNER_ENABLED;
delete process.env.RUNNER_WORKSPACE_ROOT;

const testServer = require('./helpers/testServer');
const { crearProyecto } = require('./helpers/fixtures');

test.before(testServer.start);
test.after(testServer.stop);

test('con RUNNER_ENABLED sin fijar, /runner/status informa deshabilitado', async () => {
  const { status, body } = await testServer.request('GET', '/api/runner/status');
  assert.equal(status, 200);
  assert.equal(body.habilitado, false);
});

test('con el runner deshabilitado, todos sus endpoints devuelven 501 y no tocan el sistema de archivos ni crean procesos', async () => {
  const proyecto = await crearProyecto();

  const comandos = await testServer.request('GET', '/api/runner/comandos');
  assert.equal(comandos.status, 501);

  const directorio = await testServer.request('GET', '/api/runner/directorio');
  assert.equal(directorio.status, 501);

  const iniciar = await testServer.request('POST', '/api/runner/ejecuciones', {
    body: { proyectoId: proyecto.id, directorioRelativo: '', commandId: 'npm-test' },
  });
  assert.equal(iniciar.status, 501);

  const listar = await testServer.request('GET', '/api/runner/ejecuciones');
  assert.equal(listar.status, 501);
});
