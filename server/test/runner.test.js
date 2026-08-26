const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-tool-runner-workspace-'));
const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-tool-runner-outside-'));

const escribirProyectoNpm = (nombre, scriptTest) => {
  const dir = path.join(workspaceRoot, nombre);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: nombre, version: '1.0.0', scripts: { test: scriptTest } }));
};

escribirProyectoNpm('proyecto-passed', 'node -e "process.exit(0)"');
escribirProyectoNpm('proyecto-failed', 'node -e "process.exit(1)"');
escribirProyectoNpm('proyecto-timeout', 'node -e "setInterval(() => {}, 1000)"');
fs.symlinkSync(outsideDir, path.join(workspaceRoot, 'enlace-externo'));

// Proyecto npm FUERA de la raíz, usado para probar que no se puede escapar el
// jaileo de directorios vía argumentos de npm (p.ej. `--prefix`) aunque no
// contengan `..` ni metacaracteres de shell (ver runnerProceso.service.js).
const marcadorFueraDeRaiz = path.join(outsideDir, 'se-ejecuto-fuera-de-la-raiz');
fs.writeFileSync(
  path.join(outsideDir, 'package.json'),
  JSON.stringify({ name: 'fuera-de-la-raiz', version: '1.0.0', scripts: { test: `node -e "require('fs').writeFileSync(${JSON.stringify(marcadorFueraDeRaiz)}, 'x')"` } })
);

// Igual que SQLITE_DB_PATH/LOG_FILE_PATH: seguro fijarlo aquí porque
// `node --test` aísla cada archivo en su propio proceso.
process.env.SQLITE_DB_PATH = ':memory:';
process.env.LOG_FILE_PATH = path.join(os.tmpdir(), `qa-tool-test-${process.pid}.ndjson`);
process.env.RUNNER_ENABLED = 'true';
process.env.RUNNER_WORKSPACE_ROOT = workspaceRoot;

const testServer = require('./helpers/testServer');
const { crearUsuario, crearProyecto } = require('./helpers/fixtures');

test.before(testServer.start);
test.after(testServer.stop);
test.after(() => {
  fs.rmSync(workspaceRoot, { recursive: true, force: true });
  fs.rmSync(outsideDir, { recursive: true, force: true });
});

const esperarFinalizacion = async (id, usuarioId, { timeoutMs = 5000, intervaloMs = 50 } = {}) => {
  const limite = Date.now() + timeoutMs;
  while (Date.now() < limite) {
    const { body } = await testServer.request('GET', `/api/runner/ejecuciones/${id}`, { usuarioId });
    if (body.estado !== 'en_progreso') return body;
    await new Promise((r) => setTimeout(r, intervaloMs));
  }
  throw new Error(`La ejecución ${id} no finalizó dentro de ${timeoutMs}ms`);
};

const lanzar = (usuarioId, body) => testServer.request('POST', '/api/runner/ejecuciones', { usuarioId, body });

test('capturar el código de salida: un test que pasa se guarda como passed con código 0', async () => {
  const qa = await crearUsuario('qa');
  const proyecto = await crearProyecto(qa.id);

  const { status, body } = await lanzar(qa.id, {
    proyectoId: proyecto.id,
    directorioRelativo: 'proyecto-passed',
    commandId: 'npm-test',
  });
  assert.equal(status, 201);

  const final = await esperarFinalizacion(body.id, qa.id);
  assert.equal(final.estado, 'passed');
  assert.equal(final.codigoSalida, 0);
  assert.equal(final.salidaTruncada, false);
});

test('capturar el código de salida: un test que falla se guarda como failed con código != 0', async () => {
  const qa = await crearUsuario('qa');
  const proyecto = await crearProyecto(qa.id);

  const { body } = await lanzar(qa.id, {
    proyectoId: proyecto.id,
    directorioRelativo: 'proyecto-failed',
    commandId: 'npm-test',
  });

  const final = await esperarFinalizacion(body.id, qa.id);
  assert.equal(final.estado, 'failed');
  assert.notEqual(final.codigoSalida, 0);
});

test('un comando que excede el timeout se mata y queda registrado como timeout', async () => {
  const qa = await crearUsuario('qa');
  const proyecto = await crearProyecto(qa.id);

  const previo = process.env.RUNNER_TIMEOUT_MS;
  process.env.RUNNER_TIMEOUT_MS = '300';
  try {
    const { body } = await lanzar(qa.id, {
      proyectoId: proyecto.id,
      directorioRelativo: 'proyecto-timeout',
      commandId: 'npm-test',
    });
    const final = await esperarFinalizacion(body.id, qa.id, { timeoutMs: 5000 });
    assert.equal(final.estado, 'timeout');
  } finally {
    process.env.RUNNER_TIMEOUT_MS = previo;
  }
});

test('un commandId fuera de la lista blanca se rechaza con 400 y no crea ninguna ejecución', async () => {
  const qa = await crearUsuario('qa');
  const proyecto = await crearProyecto(qa.id);

  const antes = await testServer.request('GET', `/api/runner/ejecuciones?proyectoId=${proyecto.id}`, { usuarioId: qa.id });

  const { status, body } = await lanzar(qa.id, {
    proyectoId: proyecto.id,
    directorioRelativo: 'proyecto-passed',
    commandId: 'rm-rf-todo',
  });
  assert.equal(status, 400);
  assert.equal(body.error.code, 'BAD_REQUEST');

  const despues = await testServer.request('GET', `/api/runner/ejecuciones?proyectoId=${proyecto.id}`, { usuarioId: qa.id });
  assert.equal(despues.body.pagination.total, antes.body.pagination.total);
});

test('cualquier argumento extra se rechaza con 400, aunque solo use caracteres "seguros"', async () => {
  const qa = await crearUsuario('qa');
  const proyecto = await crearProyecto(qa.id);

  const conMetacaracter = await lanzar(qa.id, {
    proyectoId: proyecto.id,
    directorioRelativo: 'proyecto-passed',
    commandId: 'npm-test',
    argumentosExtra: ['--', '$(whoami)'],
  });
  assert.equal(conMetacaracter.status, 400);
  assert.equal(conMetacaracter.body.error.code, 'BAD_REQUEST');

  const conCaracteresSeguros = await lanzar(qa.id, {
    proyectoId: proyecto.id,
    directorioRelativo: 'proyecto-passed',
    commandId: 'npm-test',
    argumentosExtra: ['--reporter=json'],
  });
  assert.equal(conCaracteresSeguros.status, 400);
  assert.equal(conCaracteresSeguros.body.error.code, 'BAD_REQUEST');
});

// Regresión: un patrón de "caracteres seguros" no basta para validar
// argumentos, porque el propio binario permitido puede tener flags que
// cambian dónde/qué ejecuta. `npm test --prefix <ruta-fuera-del-workspace>`
// no usa `..` ni metacaracteres de shell y aun así hace que npm ejecute el
// script `test` de un `package.json` totalmente distinto, fuera de la raíz
// jaileada — derrotando el sandbox de directorios sin tocar
// `directorioRelativo`. Por eso no se acepta ningún argumento extra (ver
// runnerProceso.service.js): se prueba aquí que ese vector concreto queda
// cerrado y que el comando nunca llega a ejecutarse fuera de la raíz.
test('un argumento como --prefix no puede usarse para escapar la raíz del workspace', async () => {
  const qa = await crearUsuario('qa');
  const proyecto = await crearProyecto(qa.id);

  const { status, body } = await lanzar(qa.id, {
    proyectoId: proyecto.id,
    directorioRelativo: 'proyecto-passed',
    commandId: 'npm-test',
    argumentosExtra: ['--prefix', outsideDir],
  });
  assert.equal(status, 400);
  assert.equal(body.error.code, 'BAD_REQUEST');
  assert.equal(fs.existsSync(marcadorFueraDeRaiz), false);
});

test('cd con travesía de rutas (../..) se rechaza con 400 y no crea ninguna ejecución', async () => {
  const qa = await crearUsuario('qa');
  const proyecto = await crearProyecto(qa.id);

  const { status, body } = await lanzar(qa.id, {
    proyectoId: proyecto.id,
    directorioRelativo: '../../etc',
    commandId: 'npm-test',
  });
  assert.equal(status, 400);
  assert.equal(body.error.code, 'BAD_REQUEST');
});

test('un directorioRelativo absoluto se rechaza con 400', async () => {
  const qa = await crearUsuario('qa');
  const proyecto = await crearProyecto(qa.id);

  const { status } = await lanzar(qa.id, {
    proyectoId: proyecto.id,
    directorioRelativo: '/etc',
    commandId: 'npm-test',
  });
  assert.equal(status, 400);
});

test('un symlink que apunta fuera de la raíz del workspace se rechaza con 400', async () => {
  const qa = await crearUsuario('qa');
  const proyecto = await crearProyecto(qa.id);

  const { status } = await lanzar(qa.id, {
    proyectoId: proyecto.id,
    directorioRelativo: 'enlace-externo',
    commandId: 'npm-test',
  });
  assert.equal(status, 400);
});

test('navegar (ls) con travesía de rutas también se rechaza con 400', async () => {
  const qa = await crearUsuario('qa');
  const { status } = await testServer.request('GET', '/api/runner/directorio?ruta=..%2F..%2Fetc', { usuarioId: qa.id });
  assert.equal(status, 400);
});

test('un gestor no puede iniciar ni abortar una ejecución del runner (403)', async () => {
  const qa = await crearUsuario('qa');
  const gestor = await crearUsuario('gestor');
  const proyecto = await crearProyecto(qa.id);

  const iniciar = await lanzar(gestor.id, {
    proyectoId: proyecto.id,
    directorioRelativo: 'proyecto-passed',
    commandId: 'npm-test',
  });
  assert.equal(iniciar.status, 403);

  const { body: run } = await lanzar(qa.id, {
    proyectoId: proyecto.id,
    directorioRelativo: 'proyecto-timeout',
    commandId: 'npm-test',
  });
  const abortarComoGestor = await testServer.request('PATCH', `/api/runner/ejecuciones/${run.id}/abortar`, { usuarioId: gestor.id });
  assert.equal(abortarComoGestor.status, 403);

  // abortar() dispara la señal y responde de inmediato; el estado final
  // (`cancelado`) solo queda persistido cuando el proceso realmente termina.
  const abortarComoQa = await testServer.request('PATCH', `/api/runner/ejecuciones/${run.id}/abortar`, { usuarioId: qa.id });
  assert.equal(abortarComoQa.status, 200);

  const final = await esperarFinalizacion(run.id, qa.id);
  assert.equal(final.estado, 'cancelado');
});

test('listar el historial de ejecuciones filtra por proyectoId', async () => {
  const qa = await crearUsuario('qa');
  const proyectoA = await crearProyecto(qa.id);
  const proyectoB = await crearProyecto(qa.id);

  const { body: runA } = await lanzar(qa.id, { proyectoId: proyectoA.id, directorioRelativo: 'proyecto-passed', commandId: 'npm-test' });
  await lanzar(qa.id, { proyectoId: proyectoB.id, directorioRelativo: 'proyecto-passed', commandId: 'npm-test' });
  await esperarFinalizacion(runA.id, qa.id);

  const { body } = await testServer.request('GET', `/api/runner/ejecuciones?proyectoId=${proyectoA.id}`, { usuarioId: qa.id });
  assert.ok(body.data.every((r) => r.proyectoId === proyectoA.id));
  assert.equal(body.pagination.total, 1);
});
