const test = require('node:test');
const assert = require('node:assert/strict');

const testServer = require('./helpers/testServer');
const { crearEscenarioBase, crearCicloPlanificado, asignarCasos, crearCaso, publicarCaso } = require('./helpers/fixtures');

test.before(testServer.start);
test.after(testServer.stop);

test('un ciclo nuevo nace en estado planificada', async () => {
  const { qa, proyecto } = await crearEscenarioBase();
  const ciclo = await crearCicloPlanificado(qa.id, proyecto.id);
  assert.equal(ciclo.estado, 'planificada');
});

test('asignarCasos con casoIds vacío devuelve 400', async () => {
  const { qa, proyecto } = await crearEscenarioBase();
  const ciclo = await crearCicloPlanificado(qa.id, proyecto.id);
  const res = await testServer.request('POST', `/api/ciclos/${ciclo.id}/casos`, {
    usuarioId: qa.id,
    body: { casoIds: [] },
  });
  assert.equal(res.status, 400);
});

test('máquina de estados: planificada -> en_progreso -> bloqueada -> en_progreso -> completada', async () => {
  const { qa, proyecto } = await crearEscenarioBase();
  const ciclo = await crearCicloPlanificado(qa.id, proyecto.id);

  const iniciado = await testServer.request('PATCH', `/api/ciclos/${ciclo.id}/iniciar`, { usuarioId: qa.id });
  assert.equal(iniciado.body.estado, 'en_progreso');

  const bloqueado = await testServer.request('PATCH', `/api/ciclos/${ciclo.id}/bloquear`, {
    usuarioId: qa.id,
    body: { comentario: 'Entorno caído' },
  });
  assert.equal(bloqueado.body.estado, 'bloqueada');

  const desbloqueado = await testServer.request('PATCH', `/api/ciclos/${ciclo.id}/desbloquear`, { usuarioId: qa.id });
  assert.equal(desbloqueado.body.estado, 'en_progreso');

  const completado = await testServer.request('PATCH', `/api/ciclos/${ciclo.id}/completar`, { usuarioId: qa.id });
  assert.equal(completado.body.estado, 'completada');
  assert.ok(completado.body.fechaFinReal);

  const reCompletar = await testServer.request('PATCH', `/api/ciclos/${ciclo.id}/completar`, { usuarioId: qa.id });
  assert.equal(reCompletar.status, 409);
});

test('bloquear sin comentario devuelve 400', async () => {
  const { qa, proyecto } = await crearEscenarioBase();
  const ciclo = await crearCicloPlanificado(qa.id, proyecto.id);
  await testServer.request('PATCH', `/api/ciclos/${ciclo.id}/iniciar`, { usuarioId: qa.id });

  const res = await testServer.request('PATCH', `/api/ciclos/${ciclo.id}/bloquear`, { usuarioId: qa.id, body: {} });
  assert.equal(res.status, 400);
});

test('bloquear con comentario lo persiste en el ciclo (regresión: antes se descartaba)', async () => {
  const { qa, proyecto } = await crearEscenarioBase();
  const ciclo = await crearCicloPlanificado(qa.id, proyecto.id);
  await testServer.request('PATCH', `/api/ciclos/${ciclo.id}/iniciar`, { usuarioId: qa.id });

  await testServer.request('PATCH', `/api/ciclos/${ciclo.id}/bloquear`, {
    usuarioId: qa.id,
    body: { comentario: 'Caída de base de datos de staging' },
  });

  const detalle = await testServer.request('GET', `/api/ciclos/${ciclo.id}`, { usuarioId: qa.id });
  assert.equal(detalle.body.comentario, 'Caída de base de datos de staging');
});

test('asignar un caso obsoleto a un ciclo devuelve 422 y no genera ejecución', async () => {
  const { qa, proyecto, suite } = await crearEscenarioBase();
  const caso = await crearCaso(qa.id, suite.id);
  await publicarCaso(qa.id, caso.id);
  await testServer.request('PATCH', `/api/casos/${caso.id}/deprecar`, { usuarioId: qa.id });

  const ciclo = await crearCicloPlanificado(qa.id, proyecto.id);
  const res = await testServer.request('POST', `/api/ciclos/${ciclo.id}/casos`, {
    usuarioId: qa.id,
    body: { casoIds: [caso.id] },
  });
  assert.equal(res.status, 422);

  const ejecuciones = await testServer.request('GET', `/api/ciclos/${ciclo.id}/ejecuciones`, { usuarioId: qa.id });
  assert.equal(ejecuciones.body.data.length, 0);
});

test('las métricas del ciclo (tasaExito, tasaAvance) se calculan sobre las ejecuciones', async () => {
  const { qa, proyecto, suite } = await crearEscenarioBase();
  const casoB = await crearCaso(qa.id, suite.id);
  await publicarCaso(qa.id, casoB.id);
  const casoA = await crearCaso(qa.id, suite.id);
  await publicarCaso(qa.id, casoA.id);

  const ciclo = await crearCicloPlanificado(qa.id, proyecto.id);
  await testServer.request('PATCH', `/api/ciclos/${ciclo.id}/iniciar`, { usuarioId: qa.id });
  const asignadas = await asignarCasos(qa.id, ciclo.id, [casoA.id, casoB.id]);

  for (const ejecucion of asignadas.data) {
    await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/tomar`, { usuarioId: qa.id });
  }

  const casoDeEjecucion = (ejecucionId) =>
    asignadas.data.find((e) => e.id === ejecucionId).casoId === casoA.id ? 'passed' : 'failed';

  for (const ejecucion of asignadas.data) {
    const casoId = ejecucion.casoId;
    const casoDetalle = await testServer.request('GET', `/api/casos/${casoId}`, { usuarioId: qa.id });
    const estadoResultado = casoDeEjecucion(ejecucion.id);
    await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/resultado`, {
      usuarioId: qa.id,
      body: {
        estado: estadoResultado,
        resultadosPaso: casoDetalle.body.pasos.map((p) => ({ pasoId: p.id, estado: estadoResultado === 'passed' ? 'pass' : 'fail' })),
      },
    });
  }

  const detalle = await testServer.request('GET', `/api/ciclos/${ciclo.id}`, { usuarioId: qa.id });
  assert.equal(detalle.body.passed, 1);
  assert.equal(detalle.body.failed, 1);
  assert.equal(detalle.body.tasaExito, 0.5);
  assert.equal(detalle.body.tasaAvance, 1);
});

test('un gestor no puede iniciar un ciclo (403)', async () => {
  const { gestor, qa, proyecto } = await crearEscenarioBase();
  const ciclo = await crearCicloPlanificado(qa.id, proyecto.id);
  const res = await testServer.request('PATCH', `/api/ciclos/${ciclo.id}/iniciar`, { usuarioId: gestor.id });
  assert.equal(res.status, 403);
});
