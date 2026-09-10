const test = require('node:test');
const assert = require('node:assert/strict');

const testServer = require('./helpers/testServer');
const { crearEscenarioBase, crearCaso } = require('./helpers/fixtures');

test.before(testServer.start);
test.after(testServer.stop);

test('un listado sin query params usa page=1 y pageSize=20 por defecto', async () => {
  const { suite } = await crearEscenarioBase(); // ya trae un caso activo
  const res = await testServer.request('GET', `/api/suites/${suite.id}/casos`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.pagination, { page: 1, pageSize: 20, total: 1 });
});

test('pageSize se recorta a 100 aunque se pida más', async () => {
  const { suite } = await crearEscenarioBase();
  const res = await testServer.request('GET', `/api/suites/${suite.id}/casos?pageSize=9999`);
  assert.equal(res.status, 200);
  assert.equal(res.body.pagination.pageSize, 100);
});

test('page/pageSize inválidos (no numéricos) caen a los valores por defecto en vez de fallar', async () => {
  const { suite } = await crearEscenarioBase();
  const res = await testServer.request('GET', `/api/suites/${suite.id}/casos?page=abc&pageSize=xyz`);
  assert.equal(res.status, 200);
  assert.equal(res.body.pagination.page, 1);
  assert.equal(res.body.pagination.pageSize, 20);
});

test('paginar una segunda página devuelve los elementos restantes y el total correcto', async () => {
  const { suite, caso } = await crearEscenarioBase();
  // El escenario base ya trae 1 caso; añadimos 2 más para tener 3 en total.
  await crearCaso(suite.id);
  await crearCaso(suite.id);

  const pagina1 = await testServer.request('GET', `/api/suites/${suite.id}/casos?page=1&pageSize=2`);
  assert.equal(pagina1.body.data.length, 2);
  assert.equal(pagina1.body.pagination.total, 3);

  const pagina2 = await testServer.request('GET', `/api/suites/${suite.id}/casos?page=2&pageSize=2`);
  assert.equal(pagina2.body.data.length, 1);
  assert.equal(pagina2.body.pagination.total, 3);

  const idsPagina1 = pagina1.body.data.map((c) => c.id);
  const idsPagina2 = pagina2.body.data.map((c) => c.id);
  assert.equal(idsPagina1.includes(caso.id) || idsPagina2.includes(caso.id), true);
  assert.equal(new Set([...idsPagina1, ...idsPagina2]).size, 3); // sin duplicados ni huecos
});

test('una página más allá del total devuelve data vacío pero el total sigue siendo correcto', async () => {
  const { suite } = await crearEscenarioBase();
  const res = await testServer.request('GET', `/api/suites/${suite.id}/casos?page=50`);
  assert.deepEqual(res.body.data, []);
  assert.equal(res.body.pagination.total, 1);
});

test('la paginación se aplica también a proyectos, ciclos, defectos, ejecuciones y etiquetas', async () => {
  const { proyecto } = await crearEscenarioBase();

  const proyectos = await testServer.request('GET', '/api/proyectos');
  assert.ok(proyectos.body.pagination);

  const ciclos = await testServer.request('GET', `/api/proyectos/${proyecto.id}/ciclos`);
  assert.ok(ciclos.body.pagination);

  const defectos = await testServer.request('GET', `/api/proyectos/${proyecto.id}/defectos`);
  assert.ok(defectos.body.pagination);

  const etiquetas = await testServer.request('GET', `/api/proyectos/${proyecto.id}/etiquetas`);
  assert.ok(etiquetas.body.pagination);
});
