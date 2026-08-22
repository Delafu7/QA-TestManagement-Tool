const test = require('node:test');
const assert = require('node:assert/strict');

const testServer = require('./helpers/testServer');
const { crearEscenarioBase, crearCaso, crearEjecucionPendiente } = require('./helpers/fixtures');

test.before(testServer.start);
test.after(testServer.stop);

test('crear un caso sin pasos devuelve 400', async () => {
  const { qa, suite } = await crearEscenarioBase();
  const res = await testServer.request('POST', `/api/suites/${suite.id}/casos`, {
    usuarioId: qa.id,
    body: { titulo: 'Sin pasos', prioridad: 'alta', tipo: 'funcional', autorId: qa.id, pasos: [] },
  });
  assert.equal(res.status, 400);
});

test('un caso nuevo nace en estado borrador', async () => {
  const { qa, suite } = await crearEscenarioBase();
  const caso = await crearCaso(qa.id, suite.id);
  assert.equal(caso.estado, 'borrador');
});

test('máquina de estados: borrador -> activo -> obsoleto -> activo', async () => {
  const { qa, suite } = await crearEscenarioBase();
  const caso = await crearCaso(qa.id, suite.id);

  const publicado = await testServer.request('PATCH', `/api/casos/${caso.id}/publicar`, { usuarioId: qa.id });
  assert.equal(publicado.status, 200);
  assert.equal(publicado.body.estado, 'activo');

  const deprecado = await testServer.request('PATCH', `/api/casos/${caso.id}/deprecar`, { usuarioId: qa.id });
  assert.equal(deprecado.body.estado, 'obsoleto');

  const reactivado = await testServer.request('PATCH', `/api/casos/${caso.id}/reactivar`, { usuarioId: qa.id });
  assert.equal(reactivado.body.estado, 'activo');
});

test('transición inválida (publicar un caso ya activo) devuelve 409', async () => {
  const { qa, suite } = await crearEscenarioBase();
  const caso = await crearCaso(qa.id, suite.id);
  await testServer.request('PATCH', `/api/casos/${caso.id}/publicar`, { usuarioId: qa.id });

  const res = await testServer.request('PATCH', `/api/casos/${caso.id}/publicar`, { usuarioId: qa.id });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'INVALID_TRANSITION');
});

test('un caso obsoleto no puede asignarse a un ciclo (422)', async () => {
  const { qa, proyecto, suite } = await crearEscenarioBase();
  const caso = await crearCaso(qa.id, suite.id);
  await testServer.request('PATCH', `/api/casos/${caso.id}/publicar`, { usuarioId: qa.id });
  await testServer.request('PATCH', `/api/casos/${caso.id}/deprecar`, { usuarioId: qa.id });

  const ciclo = await testServer.request('POST', `/api/proyectos/${proyecto.id}/ciclos`, {
    usuarioId: qa.id,
    body: { nombre: 'Ciclo', fechaInicio: '2026-01-01', fechaFinPrevista: '2026-01-31', responsableId: qa.id },
  });
  const res = await testServer.request('POST', `/api/ciclos/${ciclo.body.id}/casos`, {
    usuarioId: qa.id,
    body: { casoIds: [caso.id] },
  });
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'CASO_OBSOLETO');
});

test('editar un caso sin ejecuciones reemplaza los pasos correctamente', async () => {
  const { qa, caso } = await crearEscenarioBase();
  const res = await testServer.request('PATCH', `/api/casos/${caso.id}`, {
    usuarioId: qa.id,
    body: { pasos: [{ orden: 1, accion: 'Paso nuevo', resultadoEsperado: 'Resultado nuevo' }] },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.pasos.length, 1);
  assert.equal(res.body.pasos[0].accion, 'Paso nuevo');
});

test('editar el título de un caso (sin tocar pasos) funciona aunque tenga ejecuciones', async () => {
  const { qa, proyecto, caso } = await crearEscenarioBase();
  await crearEjecucionPendiente(qa.id, proyecto.id, caso.id);

  const res = await testServer.request('PATCH', `/api/casos/${caso.id}`, {
    usuarioId: qa.id,
    body: { titulo: 'Título renombrado' },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.titulo, 'Título renombrado');
});

test('editar los pasos de un caso con ejecuciones devuelve 422, no un 500 (regresión)', async () => {
  const { qa, proyecto, caso } = await crearEscenarioBase();
  await crearEjecucionPendiente(qa.id, proyecto.id, caso.id);

  const res = await testServer.request('PATCH', `/api/casos/${caso.id}`, {
    usuarioId: qa.id,
    body: { pasos: [{ orden: 1, accion: 'Paso cambiado', resultadoEsperado: 'Otro resultado' }] },
  });
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'CASO_CON_EJECUCIONES');
});

test('eliminar un caso sin ejecuciones históricas funciona (204)', async () => {
  const { qa, suite } = await crearEscenarioBase();
  const caso = await crearCaso(qa.id, suite.id);
  const res = await testServer.request('DELETE', `/api/casos/${caso.id}`, { usuarioId: qa.id });
  assert.equal(res.status, 204);
});

test('eliminar un caso con ejecuciones históricas devuelve 422', async () => {
  const { qa, proyecto, caso } = await crearEscenarioBase();
  await crearEjecucionPendiente(qa.id, proyecto.id, caso.id);

  const res = await testServer.request('DELETE', `/api/casos/${caso.id}`, { usuarioId: qa.id });
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'CASO_CON_EJECUCIONES');
});

test('un gestor no puede editar un caso (403)', async () => {
  const { gestor, caso } = await crearEscenarioBase();
  const res = await testServer.request('PATCH', `/api/casos/${caso.id}`, {
    usuarioId: gestor.id,
    body: { titulo: 'Intento de gestor' },
  });
  assert.equal(res.status, 403);
});

