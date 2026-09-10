const test = require('node:test');
const assert = require('node:assert/strict');

const testServer = require('./helpers/testServer');
const { crearEscenarioBase, crearCicloPlanificado, asignarCasos, crearCaso, publicarCaso } = require('./helpers/fixtures');

test.before(testServer.start);
test.after(testServer.stop);

test('un ciclo nuevo nace en estado planificada', async () => {
  const { proyecto } = await crearEscenarioBase();
  const ciclo = await crearCicloPlanificado(proyecto.id);
  assert.equal(ciclo.estado, 'planificada');
});

test('asignarCasos con casoIds vacío devuelve 400', async () => {
  const { proyecto } = await crearEscenarioBase();
  const ciclo = await crearCicloPlanificado(proyecto.id);
  const res = await testServer.request('POST', `/api/ciclos/${ciclo.id}/casos`, {
    body: { casoIds: [] },
  });
  assert.equal(res.status, 400);
});

test('máquina de estados: planificada -> en_progreso -> bloqueada -> en_progreso -> completada', async () => {
  const { proyecto } = await crearEscenarioBase();
  const ciclo = await crearCicloPlanificado(proyecto.id);

  const iniciado = await testServer.request('PATCH', `/api/ciclos/${ciclo.id}/iniciar`);
  assert.equal(iniciado.body.estado, 'en_progreso');

  const bloqueado = await testServer.request('PATCH', `/api/ciclos/${ciclo.id}/bloquear`, {
    body: { comentario: 'Entorno caído' },
  });
  assert.equal(bloqueado.body.estado, 'bloqueada');

  const desbloqueado = await testServer.request('PATCH', `/api/ciclos/${ciclo.id}/desbloquear`);
  assert.equal(desbloqueado.body.estado, 'en_progreso');

  const completado = await testServer.request('PATCH', `/api/ciclos/${ciclo.id}/completar`);
  assert.equal(completado.body.estado, 'completada');
  assert.ok(completado.body.fechaFinReal);

  const reCompletar = await testServer.request('PATCH', `/api/ciclos/${ciclo.id}/completar`);
  assert.equal(reCompletar.status, 409);
});

test('bloquear sin comentario devuelve 400', async () => {
  const { proyecto } = await crearEscenarioBase();
  const ciclo = await crearCicloPlanificado(proyecto.id);
  await testServer.request('PATCH', `/api/ciclos/${ciclo.id}/iniciar`);

  const res = await testServer.request('PATCH', `/api/ciclos/${ciclo.id}/bloquear`, { body: {} });
  assert.equal(res.status, 400);
});

test('bloquear con comentario lo persiste en el ciclo (regresión: antes se descartaba)', async () => {
  const { proyecto } = await crearEscenarioBase();
  const ciclo = await crearCicloPlanificado(proyecto.id);
  await testServer.request('PATCH', `/api/ciclos/${ciclo.id}/iniciar`);

  await testServer.request('PATCH', `/api/ciclos/${ciclo.id}/bloquear`, {
    body: { comentario: 'Caída de base de datos de staging' },
  });

  const detalle = await testServer.request('GET', `/api/ciclos/${ciclo.id}`);
  assert.equal(detalle.body.comentario, 'Caída de base de datos de staging');
});

test('asignar un caso obsoleto a un ciclo devuelve 422 y no genera ejecución', async () => {
  const { proyecto, suite } = await crearEscenarioBase();
  const caso = await crearCaso(suite.id);
  await publicarCaso(caso.id);
  await testServer.request('PATCH', `/api/casos/${caso.id}/deprecar`);

  const ciclo = await crearCicloPlanificado(proyecto.id);
  const res = await testServer.request('POST', `/api/ciclos/${ciclo.id}/casos`, {
    body: { casoIds: [caso.id] },
  });
  assert.equal(res.status, 422);

  const ejecuciones = await testServer.request('GET', `/api/ciclos/${ciclo.id}/ejecuciones`);
  assert.equal(ejecuciones.body.data.length, 0);
});

test('las métricas del ciclo (tasaExito, tasaAvance) se calculan sobre las ejecuciones', async () => {
  const { proyecto, suite } = await crearEscenarioBase();
  const casoB = await crearCaso(suite.id);
  await publicarCaso(casoB.id);
  const casoA = await crearCaso(suite.id);
  await publicarCaso(casoA.id);

  const ciclo = await crearCicloPlanificado(proyecto.id);
  await testServer.request('PATCH', `/api/ciclos/${ciclo.id}/iniciar`);
  const asignadas = await asignarCasos(ciclo.id, [casoA.id, casoB.id]);

  for (const ejecucion of asignadas.data) {
    await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/tomar`);
  }

  const casoDeEjecucion = (ejecucionId) =>
    asignadas.data.find((e) => e.id === ejecucionId).casoId === casoA.id ? 'passed' : 'failed';

  for (const ejecucion of asignadas.data) {
    const casoId = ejecucion.casoId;
    const casoDetalle = await testServer.request('GET', `/api/casos/${casoId}`);
    const estadoResultado = casoDeEjecucion(ejecucion.id);
    await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/resultado`, {
      body: {
        estado: estadoResultado,
        resultadosPaso: casoDetalle.body.pasos.map((p) => ({ pasoId: p.id, estado: estadoResultado === 'passed' ? 'pass' : 'fail' })),
      },
    });
  }

  const detalle = await testServer.request('GET', `/api/ciclos/${ciclo.id}`);
  assert.equal(detalle.body.passed, 1);
  assert.equal(detalle.body.failed, 1);
  assert.equal(detalle.body.tasaExito, 0.5);
  assert.equal(detalle.body.tasaAvance, 1);
});
