const test = require('node:test');
const assert = require('node:assert/strict');

const testServer = require('./helpers/testServer');
const { crearEscenarioBase, crearEjecucionPendiente } = require('./helpers/fixtures');

test.before(testServer.start);
test.after(testServer.stop);

test('tomar una ejecución pendiente la pasa a en_progreso', async () => {
  const { proyecto, caso } = await crearEscenarioBase();
  const { ejecucion } = await crearEjecucionPendiente(proyecto.id, caso.id);

  const res = await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/tomar`);
  assert.equal(res.status, 200);
  assert.equal(res.body.estado, 'en_progreso');
});

test('tomar una ejecución que ya no está pendiente devuelve 409', async () => {
  const { proyecto, caso } = await crearEscenarioBase();
  const { ejecucion } = await crearEjecucionPendiente(proyecto.id, caso.id);
  await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/tomar`);

  const res = await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/tomar`);
  assert.equal(res.status, 409);
});

test('registrar resultado sin cubrir todos los pasos devuelve 422', async () => {
  const { proyecto, caso } = await crearEscenarioBase();
  const { ejecucion } = await crearEjecucionPendiente(proyecto.id, caso.id);
  await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/tomar`);

  const res = await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/resultado`, {
    body: { estado: 'passed', resultadosPaso: [] },
  });
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'PASOS_INCOMPLETOS');
});

test('registrar resultado sobre una ejecución que no está en_progreso devuelve 409', async () => {
  const { proyecto, caso } = await crearEscenarioBase();
  const { ejecucion } = await crearEjecucionPendiente(proyecto.id, caso.id);
  // Todavía en 'pendiente': no se ha tomado.
  const res = await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/resultado`, {
    body: { estado: 'passed', resultadosPaso: [] },
  });
  assert.equal(res.status, 409);
});

test('registrar un resultado failed cierra la ejecución y permite reportar un defecto', async () => {
  const { proyecto, caso } = await crearEscenarioBase();
  const { ejecucion } = await crearEjecucionPendiente(proyecto.id, caso.id);
  await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/tomar`);

  const detalleCaso = await testServer.request('GET', `/api/casos/${caso.id}`);
  const cerrado = await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/resultado`, {
    body: {
      estado: 'failed',
      comentario: 'No redirige',
      duracionSegundos: 42,
      resultadosPaso: detalleCaso.body.pasos.map((p) => ({ pasoId: p.id, estado: 'fail', comentario: 'falla' })),
    },
  });
  assert.equal(cerrado.status, 200);
  assert.equal(cerrado.body.estado, 'failed');
  assert.ok(cerrado.body.fechaEjecucion);

  const defecto = await testServer.request('POST', `/api/ejecuciones/${ejecucion.id}/defectos`, {
    body: { titulo: 'Login no redirige', severidad: 'alta' },
  });
  assert.equal(defecto.status, 201);
  assert.equal(defecto.body.estado, 'abierto');
});

test('reintentar una ejecución failed la devuelve a pendiente', async () => {
  const { proyecto, caso } = await crearEscenarioBase();
  const { ejecucion } = await crearEjecucionPendiente(proyecto.id, caso.id);
  await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/tomar`);
  const detalleCaso = await testServer.request('GET', `/api/casos/${caso.id}`);
  await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/resultado`, {
    body: { estado: 'failed', resultadosPaso: detalleCaso.body.pasos.map((p) => ({ pasoId: p.id, estado: 'fail' })) },
  });

  const res = await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/reintentar`);
  assert.equal(res.status, 200);
  assert.equal(res.body.estado, 'pendiente');
});

test('reintentar una ejecución passed devuelve 409 (passed es terminal)', async () => {
  const { proyecto, caso } = await crearEscenarioBase();
  const { ejecucion } = await crearEjecucionPendiente(proyecto.id, caso.id);
  await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/tomar`);
  const detalleCaso = await testServer.request('GET', `/api/casos/${caso.id}`);
  await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/resultado`, {
    body: { estado: 'passed', resultadosPaso: detalleCaso.body.pasos.map((p) => ({ pasoId: p.id, estado: 'pass' })) },
  });

  const res = await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/reintentar`);
  assert.equal(res.status, 409);
});
