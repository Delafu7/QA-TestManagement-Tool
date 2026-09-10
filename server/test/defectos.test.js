const test = require('node:test');
const assert = require('node:assert/strict');

const testServer = require('./helpers/testServer');
const { crearEscenarioBase, crearEjecucionPendiente } = require('./helpers/fixtures');

test.before(testServer.start);
test.after(testServer.stop);

const crearDefectoAbierto = async () => {
  const { proyecto, caso } = await crearEscenarioBase();
  const { ejecucion } = await crearEjecucionPendiente(proyecto.id, caso.id);
  const { body: defecto } = await testServer.request('POST', `/api/ejecuciones/${ejecucion.id}/defectos`, {
    body: { titulo: 'Defecto de prueba', severidad: 'media' },
  });
  return { defecto };
};

test('un defecto nace en estado abierto', async () => {
  const { defecto } = await crearDefectoAbierto();
  assert.equal(defecto.estado, 'abierto');
});

test('máquina de estados: abierto -> en_progreso -> resuelto -> cerrado', async () => {
  const { defecto } = await crearDefectoAbierto();

  const asignado = await testServer.request('PATCH', `/api/defectos/${defecto.id}/asignar`);
  assert.equal(asignado.body.estado, 'en_progreso');

  const resuelto = await testServer.request('PATCH', `/api/defectos/${defecto.id}/resolver`);
  assert.equal(resuelto.body.estado, 'resuelto');

  const verificado = await testServer.request('PATCH', `/api/defectos/${defecto.id}/verificar`);
  assert.equal(verificado.body.estado, 'cerrado');
});

test('un defecto resuelto puede reabrirse, y desde ahí volver a asignarse', async () => {
  const { defecto } = await crearDefectoAbierto();
  await testServer.request('PATCH', `/api/defectos/${defecto.id}/asignar`);
  await testServer.request('PATCH', `/api/defectos/${defecto.id}/resolver`);

  const reabierto = await testServer.request('PATCH', `/api/defectos/${defecto.id}/reabrir`);
  assert.equal(reabierto.body.estado, 'reabierto');

  const reasignado = await testServer.request('PATCH', `/api/defectos/${defecto.id}/asignar`);
  assert.equal(reasignado.body.estado, 'en_progreso');
});

test('un defecto cerrado no admite más transiciones (409)', async () => {
  const { defecto } = await crearDefectoAbierto();
  await testServer.request('PATCH', `/api/defectos/${defecto.id}/asignar`);
  await testServer.request('PATCH', `/api/defectos/${defecto.id}/resolver`);
  await testServer.request('PATCH', `/api/defectos/${defecto.id}/verificar`);

  const res = await testServer.request('PATCH', `/api/defectos/${defecto.id}/reabrir`);
  assert.equal(res.status, 409);
});
