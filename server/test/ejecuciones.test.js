const test = require('node:test');
const assert = require('node:assert/strict');

const testServer = require('./helpers/testServer');
const { crearEscenarioBase, crearEjecucionPendiente } = require('./helpers/fixtures');

test.before(testServer.start);
test.after(testServer.stop);

test('tomar una ejecución pendiente la pasa a en_progreso y asigna al ejecutor', async () => {
  const { qa, proyecto, caso } = await crearEscenarioBase();
  const { ejecucion } = await crearEjecucionPendiente(qa.id, proyecto.id, caso.id);

  const res = await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/tomar`, { usuarioId: qa.id });
  assert.equal(res.status, 200);
  assert.equal(res.body.estado, 'en_progreso');
  assert.equal(res.body.ejecutorId, qa.id);
});

test('tomar una ejecución que ya no está pendiente devuelve 409', async () => {
  const { qa, proyecto, caso } = await crearEscenarioBase();
  const { ejecucion } = await crearEjecucionPendiente(qa.id, proyecto.id, caso.id);
  await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/tomar`, { usuarioId: qa.id });

  const res = await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/tomar`, { usuarioId: qa.id });
  assert.equal(res.status, 409);
});

test('registrar resultado sin cubrir todos los pasos devuelve 422', async () => {
  const { qa, proyecto, caso } = await crearEscenarioBase();
  const { ejecucion } = await crearEjecucionPendiente(qa.id, proyecto.id, caso.id);
  await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/tomar`, { usuarioId: qa.id });

  const res = await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/resultado`, {
    usuarioId: qa.id,
    body: { estado: 'passed', resultadosPaso: [] },
  });
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'PASOS_INCOMPLETOS');
});

test('registrar resultado sobre una ejecución que no está en_progreso devuelve 409', async () => {
  const { qa, proyecto, caso } = await crearEscenarioBase();
  const { ejecucion } = await crearEjecucionPendiente(qa.id, proyecto.id, caso.id);
  // Todavía en 'pendiente': no se ha tomado.
  const res = await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/resultado`, {
    usuarioId: qa.id,
    body: { estado: 'passed', resultadosPaso: [] },
  });
  assert.equal(res.status, 409);
});

test('registrar un resultado failed cierra la ejecución y permite reportar un defecto', async () => {
  const { qa, proyecto, caso } = await crearEscenarioBase();
  const { ejecucion } = await crearEjecucionPendiente(qa.id, proyecto.id, caso.id);
  await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/tomar`, { usuarioId: qa.id });

  const detalleCaso = await testServer.request('GET', `/api/casos/${caso.id}`, { usuarioId: qa.id });
  const cerrado = await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/resultado`, {
    usuarioId: qa.id,
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
    usuarioId: qa.id,
    body: { titulo: 'Login no redirige', severidad: 'alta', reportadoPorId: qa.id },
  });
  assert.equal(defecto.status, 201);
  assert.equal(defecto.body.estado, 'abierto');
});

test('reintentar una ejecución failed la devuelve a pendiente', async () => {
  const { qa, proyecto, caso } = await crearEscenarioBase();
  const { ejecucion } = await crearEjecucionPendiente(qa.id, proyecto.id, caso.id);
  await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/tomar`, { usuarioId: qa.id });
  const detalleCaso = await testServer.request('GET', `/api/casos/${caso.id}`, { usuarioId: qa.id });
  await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/resultado`, {
    usuarioId: qa.id,
    body: { estado: 'failed', resultadosPaso: detalleCaso.body.pasos.map((p) => ({ pasoId: p.id, estado: 'fail' })) },
  });

  const res = await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/reintentar`, { usuarioId: qa.id });
  assert.equal(res.status, 200);
  assert.equal(res.body.estado, 'pendiente');
});

test('reintentar una ejecución passed devuelve 409 (passed es terminal)', async () => {
  const { qa, proyecto, caso } = await crearEscenarioBase();
  const { ejecucion } = await crearEjecucionPendiente(qa.id, proyecto.id, caso.id);
  await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/tomar`, { usuarioId: qa.id });
  const detalleCaso = await testServer.request('GET', `/api/casos/${caso.id}`, { usuarioId: qa.id });
  await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/resultado`, {
    usuarioId: qa.id,
    body: { estado: 'passed', resultadosPaso: detalleCaso.body.pasos.map((p) => ({ pasoId: p.id, estado: 'pass' })) },
  });

  const res = await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/reintentar`, { usuarioId: qa.id });
  assert.equal(res.status, 409);
});

test('un gestor no puede tomar una ejecución (403)', async () => {
  const { qa, gestor, proyecto, caso } = await crearEscenarioBase();
  const { ejecucion } = await crearEjecucionPendiente(qa.id, proyecto.id, caso.id);
  const res = await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/tomar`, { usuarioId: gestor.id });
  assert.equal(res.status, 403);
});
