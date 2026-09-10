const test = require('node:test');
const assert = require('node:assert/strict');

const testServer = require('./helpers/testServer');
const { crearEscenarioBase } = require('./helpers/fixtures');

test.before(testServer.start);
test.after(testServer.stop);

test('editar un caso crea una versión con el estado ANTERIOR al cambio', async () => {
  const { caso } = await crearEscenarioBase();

  const res = await testServer.request('PATCH', `/api/casos/${caso.id}`, {
    body: { titulo: 'Título nuevo' },
  });
  assert.equal(res.status, 200);

  const versiones = await testServer.request('GET', `/api/casos/${caso.id}/versiones`);
  assert.equal(versiones.status, 200);
  assert.equal(versiones.body.length, 1);
  assert.equal(versiones.body[0].version, 1);
  assert.equal(versiones.body[0].titulo, caso.titulo); // el título ANTERIOR, no "Título nuevo"
});

test('crear un caso no genera ninguna versión; cada PATCH suma una', async () => {
  const { caso } = await crearEscenarioBase();

  const sinCambios = await testServer.request('GET', `/api/casos/${caso.id}/versiones`);
  assert.equal(sinCambios.body.length, 0);

  await testServer.request('PATCH', `/api/casos/${caso.id}`, { body: { titulo: 'v2' } });
  await testServer.request('PATCH', `/api/casos/${caso.id}`, { body: { titulo: 'v3' } });

  const conCambios = await testServer.request('GET', `/api/casos/${caso.id}/versiones`);
  assert.equal(conCambios.body.length, 2);
  assert.deepEqual(conCambios.body.map((v) => v.version), [1, 2]);
  assert.equal(conCambios.body[1].titulo, 'v2'); // versión 2 = estado justo antes del PATCH a "v3"
});

test('casos-modificados del proyecto cuenta casos DISTINTOS, no una fila por edición', async () => {
  const { proyecto, caso } = await crearEscenarioBase();

  await testServer.request('PATCH', `/api/casos/${caso.id}`, { body: { titulo: 'a' } });
  await testServer.request('PATCH', `/api/casos/${caso.id}`, { body: { titulo: 'b' } });

  const res = await testServer.request('GET', `/api/proyectos/${proyecto.id}/casos-modificados`);
  assert.equal(res.status, 200);
  assert.equal(res.body.pagination.total, 1); // un solo caso, aunque tuvo 2 ediciones
  assert.equal(res.body.data[0].numCambios, 2);
  assert.equal(res.body.data[0].casoId, caso.id);
});

test('casos-modificados respeta el rango desde/hasta (ediciones fuera del periodo no cuentan)', async () => {
  const { proyecto, caso } = await crearEscenarioBase();
  await testServer.request('PATCH', `/api/casos/${caso.id}`, { body: { titulo: 'editado hoy' } });

  const futuro = await testServer.request('GET', `/api/proyectos/${proyecto.id}/casos-modificados?desde=2099-01-01&hasta=2099-01-31`, {
  });
  assert.equal(futuro.body.pagination.total, 0);
  assert.deepEqual(futuro.body.data, []);
});

test('casos-modificados sin ningún cambio en el proyecto devuelve total 0 y data vacía (sin NaN)', async () => {
  const { proyecto } = await crearEscenarioBase();
  const res = await testServer.request('GET', `/api/proyectos/${proyecto.id}/casos-modificados`);
  assert.equal(res.status, 200);
  assert.equal(res.body.pagination.total, 0);
  assert.deepEqual(res.body.data, []);
});

test('la cuenta de casos-modificados sigue siendo correcta cuando hay más casos que un pageSize pequeño', async () => {
  const { proyecto, suite } = await crearEscenarioBase();
  const { crearCaso } = require('./helpers/fixtures');
  const casoA = await crearCaso(suite.id);
  const casoB = await crearCaso(suite.id);
  const casoC = await crearCaso(suite.id);
  for (const c of [casoA, casoB, casoC]) {
    await testServer.request('PATCH', `/api/casos/${c.id}`, { body: { titulo: `${c.titulo}-editado` } });
  }

  const res = await testServer.request('GET', `/api/proyectos/${proyecto.id}/casos-modificados?pageSize=2`);
  assert.equal(res.body.data.length, 2); // solo una página de resultados...
  assert.equal(res.body.pagination.total, 3); // ...pero el total refleja el conjunto completo, no la página
});

test('el endpoint de versiones y el de casos-modificados son de solo lectura y accesibles siempre', async () => {
  const { proyecto, caso } = await crearEscenarioBase();
  await testServer.request('PATCH', `/api/casos/${caso.id}`, { body: { titulo: 'editado' } });

  const versiones = await testServer.request('GET', `/api/casos/${caso.id}/versiones`);
  assert.equal(versiones.status, 200);
  assert.equal(versiones.body.length, 1);

  const modificados = await testServer.request('GET', `/api/proyectos/${proyecto.id}/casos-modificados`);
  assert.equal(modificados.status, 200);
  assert.equal(modificados.body.pagination.total, 1);
});
