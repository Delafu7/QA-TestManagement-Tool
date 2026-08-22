const test = require('node:test');
const assert = require('node:assert/strict');

const testServer = require('./helpers/testServer');
const { crearEscenarioBase, crearSuite, crearCaso } = require('./helpers/fixtures');

test.before(testServer.start);
test.after(testServer.stop);

test('eliminar una suite sin casos activos funciona (204)', async () => {
  const { qa, proyecto } = await crearEscenarioBase();
  const suite = await crearSuite(qa.id, proyecto.id);
  const res = await testServer.request('DELETE', `/api/suites/${suite.id}`, { usuarioId: qa.id });
  assert.equal(res.status, 204);
});

test('eliminar una suite con un caso activo devuelve 422', async () => {
  const { qa, suite } = await crearEscenarioBase(); // ya trae un caso publicado (activo)
  const res = await testServer.request('DELETE', `/api/suites/${suite.id}`, { usuarioId: qa.id });
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'SUITE_CON_CASOS_ACTIVOS');
});

test('eliminar una suite con un caso en borrador (sin ejecuciones ni estado activo) devuelve 422, no un 500 (regresión)', async () => {
  const { qa, proyecto } = await crearEscenarioBase();
  const suite = await crearSuite(qa.id, proyecto.id);
  await crearCaso(qa.id, suite.id); // se queda en 'borrador': no lo bloquea SUITE_CON_CASOS_ACTIVOS

  const res = await testServer.request('DELETE', `/api/suites/${suite.id}`, { usuarioId: qa.id });
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'SUITE_NO_VACIA');
});

test('eliminar una suite con una sub-suite devuelve 422, no un 500 (regresión)', async () => {
  const { qa, proyecto } = await crearEscenarioBase();
  const padre = await crearSuite(qa.id, proyecto.id);
  await crearSuite(qa.id, proyecto.id, { suitePadreId: padre.id });

  const res = await testServer.request('DELETE', `/api/suites/${padre.id}`, { usuarioId: qa.id });
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'SUITE_CON_SUBSUITES');
});

test('un gestor no puede crear una suite (403)', async () => {
  const { gestor, proyecto } = await crearEscenarioBase();
  const res = await testServer.request('POST', `/api/proyectos/${proyecto.id}/suites`, {
    usuarioId: gestor.id,
    body: { nombre: 'Suite de gestor' },
  });
  assert.equal(res.status, 403);
});
