const test = require('node:test');
const assert = require('node:assert/strict');

const testServer = require('./helpers/testServer');
const { crearUsuario, crearProyecto } = require('./helpers/fixtures');

test.before(testServer.start);
test.after(testServer.stop);

test('GET /health responde ok sin autenticación', async () => {
  const res = await testServer.request('GET', '/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

test('GET /api/proyectos sin X-User-Id devuelve 401', async () => {
  const res = await testServer.request('GET', '/api/proyectos');
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'UNAUTHORIZED');
});

test('GET /api/proyectos con X-User-Id que no existe devuelve 401', async () => {
  const res = await testServer.request('GET', '/api/proyectos', { usuarioId: 'no-existe' });
  assert.equal(res.status, 401);
});

test('POST /api/usuarios (bootstrap del selector) no requiere autenticación', async () => {
  const res = await testServer.request('POST', '/api/usuarios', {
    body: { nombre: 'Nuevo QA', email: `bootstrap-${Date.now()}@example.com`, rol: 'qa' },
  });
  assert.equal(res.status, 201);
});

test('PATCH /api/usuarios/:id sin X-User-Id devuelve 401 (regresión: antes no exigía auth)', async () => {
  const usuario = await crearUsuario('qa');
  const res = await testServer.request('PATCH', `/api/usuarios/${usuario.id}`, {
    body: { rol: 'gestor' },
  });
  assert.equal(res.status, 401);
});

test('PATCH /api/usuarios/:id con un gestor autenticado funciona', async () => {
  const usuario = await crearUsuario('qa');
  const gestor = await crearUsuario('gestor');
  const res = await testServer.request('PATCH', `/api/usuarios/${usuario.id}`, {
    usuarioId: gestor.id,
    body: { nombre: 'Nombre actualizado' },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.nombre, 'Nombre actualizado');
});

test('un qa no puede editar un usuario, ni siquiera a sí mismo (403, evita auto-promoción de rol)', async () => {
  const usuario = await crearUsuario('qa');
  const res = await testServer.request('PATCH', `/api/usuarios/${usuario.id}`, {
    usuarioId: usuario.id,
    body: { rol: 'gestor' },
  });
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
});

test('un gestor no puede crear un proyecto (403)', async () => {
  const gestor = await crearUsuario('gestor');
  const res = await testServer.request('POST', '/api/proyectos', {
    usuarioId: gestor.id,
    body: { nombre: 'Proyecto de gestor', propietarioId: gestor.id },
  });
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
});

test('un qa sí puede crear un proyecto (201)', async () => {
  const qa = await crearUsuario('qa');
  const res = await testServer.request('POST', '/api/proyectos', {
    usuarioId: qa.id,
    body: { nombre: 'Proyecto de qa', propietarioId: qa.id },
  });
  assert.equal(res.status, 201);
});

test('exportar (JSON) está permitido tanto para qa como para gestor', async () => {
  const qa = await crearUsuario('qa');
  const gestor = await crearUsuario('gestor');
  const proyecto = await crearProyecto(qa.id);
  const cicloRes = await testServer.request('POST', `/api/proyectos/${proyecto.id}/ciclos`, {
    usuarioId: qa.id,
    body: { nombre: 'Ciclo export', fechaInicio: '2026-01-01', fechaFinPrevista: '2026-01-31', responsableId: qa.id },
  });
  const cicloId = cicloRes.body.id;

  const comoGestor = await testServer.request('GET', `/api/ciclos/${cicloId}/export/json`, { usuarioId: gestor.id });
  assert.equal(comoGestor.status, 200);

  const comoQa = await testServer.request('GET', `/api/ciclos/${cicloId}/export/json`, { usuarioId: qa.id });
  assert.equal(comoQa.status, 200);
});
