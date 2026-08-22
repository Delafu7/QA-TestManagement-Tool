const test = require('node:test');
const assert = require('node:assert/strict');

const testServer = require('./helpers/testServer');
const { crearEscenarioBase, crearCicloPlanificado, asignarCasos } = require('./helpers/fixtures');

test.before(testServer.start);
test.after(testServer.stop);

test('cobertura por suite: caso activo sin ninguna ejecución en el ciclo da 0%, no NaN', async () => {
  const { qa, proyecto, suite } = await crearEscenarioBase();
  // El caso de crearEscenarioBase queda publicado (activo); creamos un ciclo aparte
  // sin asignarle ningún caso para forzar 0 ejecuciones y comprobar la guarda.
  const ciclo = await crearCicloPlanificado(qa.id, proyecto.id);
  await testServer.request('PATCH', `/api/ciclos/${ciclo.id}/iniciar`, { usuarioId: qa.id });

  const res = await testServer.request('GET', `/api/ciclos/${ciclo.id}/cobertura`, { usuarioId: qa.id });
  assert.equal(res.status, 200);
  const fila = res.body.data.find((s) => s.suiteId === suite.id);
  assert.ok(fila);
  assert.equal(fila.totalCasos, 1); // el caso activo de crearEscenarioBase
  assert.equal(fila.casosCubiertos, 0); // no se le asignó ejecución en este ciclo
  assert.equal(fila.pctCobertura, 0);
});

test('cobertura por suite: caso activo con ejecución asignada cuenta como cubierto', async () => {
  const { qa, proyecto, suite, caso } = await crearEscenarioBase();
  const ciclo = await crearCicloPlanificado(qa.id, proyecto.id);
  await testServer.request('PATCH', `/api/ciclos/${ciclo.id}/iniciar`, { usuarioId: qa.id });
  await asignarCasos(qa.id, ciclo.id, [caso.id]);

  const res = await testServer.request('GET', `/api/ciclos/${ciclo.id}/cobertura`, { usuarioId: qa.id });
  const fila = res.body.data.find((s) => s.suiteId === suite.id);
  assert.equal(fila.totalCasos, 1);
  assert.equal(fila.casosCubiertos, 1);
  assert.equal(fila.pctCobertura, 100);
});

test('cobertura de una suite cuyo único caso sigue en borrador (0 casos activos): pctCobertura null, no dividir por cero', async () => {
  const { qa, proyecto } = await crearEscenarioBase();
  const { crearSuite, crearCaso } = require('./helpers/fixtures');
  const suiteBorrador = await crearSuite(qa.id, proyecto.id);
  await crearCaso(qa.id, suiteBorrador.id); // se queda en borrador, no se publica
  const ciclo = await crearCicloPlanificado(qa.id, proyecto.id);
  await testServer.request('PATCH', `/api/ciclos/${ciclo.id}/iniciar`, { usuarioId: qa.id });

  const res = await testServer.request('GET', `/api/ciclos/${ciclo.id}/cobertura`, { usuarioId: qa.id });
  assert.equal(res.status, 200);
  const fila = res.body.data.find((s) => s.suiteId === suiteBorrador.id);
  assert.ok(fila);
  assert.equal(fila.totalCasos, 0);
  assert.equal(fila.pctCobertura, null); // 0/0 no debe dar NaN ni Infinity
});
