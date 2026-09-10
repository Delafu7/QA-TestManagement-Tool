const test = require('node:test');
const assert = require('node:assert/strict');

const testServer = require('./helpers/testServer');
const { crearEscenarioBase, crearCicloPlanificado, asignarCasos } = require('./helpers/fixtures');

test.before(testServer.start);
test.after(testServer.stop);

test('export JSON de un ciclo sin ejecuciones: resumen en cero y tasaExito null', async () => {
  const { proyecto } = await crearEscenarioBase();
  const ciclo = await crearCicloPlanificado(proyecto.id);

  const res = await testServer.request('GET', `/api/ciclos/${ciclo.id}/export/json`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.ejecuciones, []);
  assert.equal(res.body.resumen.totalCasos, 0);
  assert.equal(res.body.resumen.tasaExito, null);
  assert.equal(res.body.proyecto.id, proyecto.id);
});

test('export JSON incluye resultadosPaso y defectos por ejecución', async () => {
  const { proyecto, caso } = await crearEscenarioBase();
  const ciclo = await crearCicloPlanificado(proyecto.id);
  await testServer.request('PATCH', `/api/ciclos/${ciclo.id}/iniciar`);
  const { data: ejecuciones } = await asignarCasos(ciclo.id, [caso.id]);
  const ejecucion = ejecuciones[0];

  await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/tomar`);
  const detalleCaso = await testServer.request('GET', `/api/casos/${caso.id}`);
  await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/resultado`, {
    body: {
      estado: 'failed',
      comentario: 'No redirige',
      duracionSegundos: 95,
      resultadosPaso: detalleCaso.body.pasos.map((p) => ({ pasoId: p.id, estado: 'fail', comentario: 'se queda en blanco' })),
    },
  });
  await testServer.request('POST', `/api/ejecuciones/${ejecucion.id}/defectos`, {
    body: { titulo: 'Login no redirige', severidad: 'alta' },
  });

  const res = await testServer.request('GET', `/api/ciclos/${ciclo.id}/export/json`);
  assert.equal(res.status, 200);
  assert.equal(res.body.resumen.failed, 1);
  assert.equal(res.body.resumen.tasaExito, 0);
  const ejecucionExportada = res.body.ejecuciones[0];
  assert.equal(ejecucionExportada.casoTitulo, caso.titulo);
  assert.equal(ejecucionExportada.resultadosPaso.length, 1);
  assert.equal(ejecucionExportada.resultadosPaso[0].estado, 'fail');
  assert.equal(ejecucionExportada.defectos.length, 1);
});

test('export Markdown contiene la cabecera, el resumen y una fila por ejecución', async () => {
  const { proyecto, caso } = await crearEscenarioBase();
  const ciclo = await crearCicloPlanificado(proyecto.id);
  await testServer.request('PATCH', `/api/ciclos/${ciclo.id}/iniciar`);
  const { data: ejecuciones } = await asignarCasos(ciclo.id, [caso.id]);
  const ejecucion = ejecuciones[0];
  await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/tomar`);
  const detalleCaso = await testServer.request('GET', `/api/casos/${caso.id}`);
  await testServer.request('PATCH', `/api/ejecuciones/${ejecucion.id}/resultado`, {
    body: { estado: 'passed', resultadosPaso: detalleCaso.body.pasos.map((p) => ({ pasoId: p.id, estado: 'pass' })) },
  });

  const res = await testServer.request('GET', `/api/ciclos/${ciclo.id}/export/markdown`);
  assert.equal(res.status, 200);
  assert.match(res.text, new RegExp(`^# Resultados — ${ciclo.nombre}`));
  assert.match(res.text, /Tasa de éxito: 100%/);
  assert.match(res.text, new RegExp(caso.titulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('export Markdown reporta N/D cuando no hay ejecuciones con resultado (tasaExito null)', async () => {
  const { proyecto } = await crearEscenarioBase();
  const ciclo = await crearCicloPlanificado(proyecto.id);

  const res = await testServer.request('GET', `/api/ciclos/${ciclo.id}/export/markdown`);
  assert.equal(res.status, 200);
  assert.match(res.text, /Tasa de éxito: N\/D/);
});
