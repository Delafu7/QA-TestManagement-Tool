const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const os = require('os');

process.env.SQLITE_DB_PATH = ':memory:';
process.env.LOG_FILE_PATH = path.join(os.tmpdir(), `qa-tool-test-${process.pid}.ndjson`);
delete process.env.RUNNER_ENABLED;
delete process.env.RUNNER_WORKSPACE_ROOT;

const testServer = require('./helpers/testServer');
const { crearUsuario, crearProyecto } = require('./helpers/fixtures');

test.before(testServer.start);
test.after(testServer.stop);

test('con RUNNER_ENABLED sin fijar, /runner/status informa deshabilitado', async () => {
  const qa = await crearUsuario('qa');
  const { status, body } = await testServer.request('GET', '/api/runner/status', { usuarioId: qa.id });
  assert.equal(status, 200);
  assert.equal(body.habilitado, false);
});

test('con el runner deshabilitado, todos sus endpoints devuelven 501 y no tocan el sistema de archivos ni crean procesos', async () => {
  const qa = await crearUsuario('qa');
  const proyecto = await crearProyecto(qa.id);

  const comandos = await testServer.request('GET', '/api/runner/comandos', { usuarioId: qa.id });
  assert.equal(comandos.status, 501);

  const directorio = await testServer.request('GET', '/api/runner/directorio', { usuarioId: qa.id });
  assert.equal(directorio.status, 501);

  const iniciar = await testServer.request('POST', '/api/runner/ejecuciones', {
    usuarioId: qa.id,
    body: { proyectoId: proyecto.id, directorioRelativo: '', commandId: 'npm-test' },
  });
  assert.equal(iniciar.status, 501);

  const listar = await testServer.request('GET', '/api/runner/ejecuciones', { usuarioId: qa.id });
  assert.equal(listar.status, 501);
});
