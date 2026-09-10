const test = require('node:test');
const assert = require('node:assert/strict');

const testServer = require('./helpers/testServer');

test.before(testServer.start);
test.after(testServer.stop);

test('GET /health responde ok', async () => {
  const res = await testServer.request('GET', '/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

test('la API no requiere ninguna cabecera de identidad (app single-user)', async () => {
  const res = await testServer.request('GET', '/api/proyectos');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
});

test('POST /api/proyectos crea un proyecto sin propietario', async () => {
  const res = await testServer.request('POST', '/api/proyectos', { body: { nombre: 'Proyecto sin dueño' } });
  assert.equal(res.status, 201);
  assert.equal(res.body.nombre, 'Proyecto sin dueño');
  assert.equal(res.body.propietarioId, undefined);
});

test('exportar (JSON) de un ciclo funciona', async () => {
  const proyecto = (await testServer.request('POST', '/api/proyectos', { body: { nombre: 'Proyecto export' } })).body;
  const ciclo = (
    await testServer.request('POST', `/api/proyectos/${proyecto.id}/ciclos`, {
      body: { nombre: 'Ciclo export', fechaInicio: '2026-01-01', fechaFinPrevista: '2026-01-31' },
    })
  ).body;
  const res = await testServer.request('GET', `/api/ciclos/${ciclo.id}/export/json`);
  assert.equal(res.status, 200);
});
