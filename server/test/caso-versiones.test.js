const test = require('node:test');
const assert = require('node:assert/strict');

const testServer = require('./helpers/testServer');
const { crearEscenarioBase } = require('./helpers/fixtures');

test.before(testServer.start);
test.after(testServer.stop);

test('editar un caso crea una versión con el estado ANTERIOR al cambio', async () => {
  const { qa, caso } = await crearEscenarioBase();

  const res = await testServer.request('PATCH', `/api/casos/${caso.id}`, {
    usuarioId: qa.id,
    body: { titulo: 'Título nuevo' },
  });
  assert.equal(res.status, 200);

  const versiones = await testServer.request('GET', `/api/casos/${caso.id}/versiones`, { usuarioId: qa.id });
  assert.equal(versiones.status, 200);
  assert.equal(versiones.body.length, 1);
  assert.equal(versiones.body[0].version, 1);
  assert.equal(versiones.body[0].titulo, caso.titulo); // el título ANTERIOR, no "Título nuevo"
  assert.equal(versiones.body[0].editadoPorId, qa.id);
});

test('crear un caso no genera ninguna versión; cada PATCH suma una', async () => {
  const { qa, caso } = await crearEscenarioBase();

  const sinCambios = await testServer.request('GET', `/api/casos/${caso.id}/versiones`, { usuarioId: qa.id });
  assert.equal(sinCambios.body.length, 0);

  await testServer.request('PATCH', `/api/casos/${caso.id}`, { usuarioId: qa.id, body: { titulo: 'v2' } });
  await testServer.request('PATCH', `/api/casos/${caso.id}`, { usuarioId: qa.id, body: { titulo: 'v3' } });

  const conCambios = await testServer.request('GET', `/api/casos/${caso.id}/versiones`, { usuarioId: qa.id });
  assert.equal(conCambios.body.length, 2);
  assert.deepEqual(conCambios.body.map((v) => v.version), [1, 2]);
  assert.equal(conCambios.body[1].titulo, 'v2'); // versión 2 = estado justo antes del PATCH a "v3"
});

test('casos-modificados del proyecto cuenta casos DISTINTOS, no una fila por edición', async () => {
  const { qa, proyecto, caso } = await crearEscenarioBase();

  await testServer.request('PATCH', `/api/casos/${caso.id}`, { usuarioId: qa.id, body: { titulo: 'a' } });
  await testServer.request('PATCH', `/api/casos/${caso.id}`, { usuarioId: qa.id, body: { titulo: 'b' } });

  const res = await testServer.request('GET', `/api/proyectos/${proyecto.id}/casos-modificados`, { usuarioId: qa.id });
  assert.equal(res.status, 200);
  assert.equal(res.body.pagination.total, 1); // un solo caso, aunque tuvo 2 ediciones
  assert.equal(res.body.data[0].numCambios, 2);
  assert.equal(res.body.data[0].casoId, caso.id);
});

test('casos-modificados respeta el rango desde/hasta (ediciones fuera del periodo no cuentan)', async () => {
  const { qa, proyecto, caso } = await crearEscenarioBase();
  await testServer.request('PATCH', `/api/casos/${caso.id}`, { usuarioId: qa.id, body: { titulo: 'editado hoy' } });

  const futuro = await testServer.request('GET', `/api/proyectos/${proyecto.id}/casos-modificados?desde=2099-01-01&hasta=2099-01-31`, {
    usuarioId: qa.id,
  });
  assert.equal(futuro.body.pagination.total, 0);
  assert.deepEqual(futuro.body.data, []);
});

test('casos-modificados sin ningún cambio en el proyecto devuelve total 0 y data vacía (sin NaN)', async () => {
  const { qa, proyecto } = await crearEscenarioBase();
  const res = await testServer.request('GET', `/api/proyectos/${proyecto.id}/casos-modificados`, { usuarioId: qa.id });
  assert.equal(res.status, 200);
  assert.equal(res.body.pagination.total, 0);
  assert.deepEqual(res.body.data, []);
});

test('la cuenta de casos-modificados sigue siendo correcta cuando hay más casos que un pageSize pequeño', async () => {
  const { qa, proyecto, suite } = await crearEscenarioBase();
  const { crearCaso } = require('./helpers/fixtures');
  const casoA = await crearCaso(qa.id, suite.id);
  const casoB = await crearCaso(qa.id, suite.id);
  const casoC = await crearCaso(qa.id, suite.id);
  for (const c of [casoA, casoB, casoC]) {
    await testServer.request('PATCH', `/api/casos/${c.id}`, { usuarioId: qa.id, body: { titulo: `${c.titulo}-editado` } });
  }

  const res = await testServer.request('GET', `/api/proyectos/${proyecto.id}/casos-modificados?pageSize=2`, { usuarioId: qa.id });
  assert.equal(res.body.data.length, 2); // solo una página de resultados...
  assert.equal(res.body.pagination.total, 3); // ...pero el total refleja el conjunto completo, no la página
});

test('un gestor no puede editar un caso, así que su lectura de versiones/casos-modificados no se ve afectada por permisos de escritura', async () => {
  const { qa, gestor, proyecto, caso } = await crearEscenarioBase();
  await testServer.request('PATCH', `/api/casos/${caso.id}`, { usuarioId: qa.id, body: { titulo: 'editado por qa' } });

  const versiones = await testServer.request('GET', `/api/casos/${caso.id}/versiones`, { usuarioId: gestor.id });
  assert.equal(versiones.status, 200);
  assert.equal(versiones.body.length, 1);

  const modificados = await testServer.request('GET', `/api/proyectos/${proyecto.id}/casos-modificados`, { usuarioId: gestor.id });
  assert.equal(modificados.status, 200);
  assert.equal(modificados.body.pagination.total, 1);
});
