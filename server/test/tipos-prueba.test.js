const test = require('node:test');
const assert = require('node:assert/strict');

const testServer = require('./helpers/testServer');
const { crearEscenarioBase, crearCaso, crearCicloPlanificado, asignarCasos } = require('./helpers/fixtures');

test.before(testServer.start);
test.after(testServer.stop);

const listarTipos = async (usuarioId, proyectoId) =>
  (await testServer.request('GET', `/api/proyectos/${proyectoId}/tipos-prueba`, { usuarioId })).body;

const cerrarComoFailed = async (qaId, ejecucionId, casoId) => {
  await testServer.request('PATCH', `/api/ejecuciones/${ejecucionId}/tomar`, { usuarioId: qaId });
  const caso = (await testServer.request('GET', `/api/casos/${casoId}`, { usuarioId: qaId })).body;
  const resultadosPaso = caso.pasos.map((p) => ({ pasoId: p.id, estado: 'fail' }));
  const res = await testServer.request('PATCH', `/api/ejecuciones/${ejecucionId}/resultado`, {
    usuarioId: qaId,
    body: { estado: 'failed', resultadosPaso },
  });
  return res.body;
};

test('crear un proyecto siembra automáticamente los 8 tipos de prueba por defecto', async () => {
  const { qa, proyecto } = await crearEscenarioBase();
  const tipos = await listarTipos(qa.id, proyecto.id);
  assert.equal(tipos.length, 8);
  assert.ok(tipos.every((t) => t.archivado === false));
});

test('un gestor no puede crear, editar ni archivar un tipo de prueba (403)', async () => {
  const { gestor, proyecto } = await crearEscenarioBase();
  const crear = await testServer.request('POST', `/api/proyectos/${proyecto.id}/tipos-prueba`, {
    usuarioId: gestor.id,
    body: { nombre: 'Carga', color: '#123456' },
  });
  assert.equal(crear.status, 403);

  const tipos = await listarTipos(gestor.id, proyecto.id);
  const editar = await testServer.request('PATCH', `/api/tipos-prueba/${tipos[0].id}`, {
    usuarioId: gestor.id,
    body: { nombre: 'Renombrado' },
  });
  assert.equal(editar.status, 403);

  const archivar = await testServer.request('PATCH', `/api/tipos-prueba/${tipos[0].id}/archivar`, { usuarioId: gestor.id });
  assert.equal(archivar.status, 403);
});

test('un qa puede crear, editar y archivar un tipo de prueba', async () => {
  const { qa, proyecto } = await crearEscenarioBase();
  const crear = await testServer.request('POST', `/api/proyectos/${proyecto.id}/tipos-prueba`, {
    usuarioId: qa.id,
    body: { nombre: 'Carga', color: '#123456' },
  });
  assert.equal(crear.status, 201);
  assert.equal(crear.body.slug, 'carga');

  const editar = await testServer.request('PATCH', `/api/tipos-prueba/${crear.body.id}`, {
    usuarioId: qa.id,
    body: { nombre: 'Carga y estrés' },
  });
  assert.equal(editar.status, 200);
  assert.equal(editar.body.nombre, 'Carga y estrés');

  const archivar = await testServer.request('PATCH', `/api/tipos-prueba/${crear.body.id}/archivar`, { usuarioId: qa.id });
  assert.equal(archivar.status, 200);
  assert.equal(archivar.body.archivado, true);
});

test('crear un caso sin tipoPruebaId lo resuelve automáticamente a partir del `tipo` legado', async () => {
  const { qa, suite, proyecto } = await crearEscenarioBase();
  const caso = await crearCaso(qa.id, suite.id, { tipo: 'regresion' });
  const tipos = await listarTipos(qa.id, proyecto.id);
  const regresion = tipos.find((t) => t.slug === 'regresion');
  assert.equal(caso.tipoPruebaId, regresion.id);
});

test('crear un caso con un tipoPruebaId de otro proyecto devuelve 400', async () => {
  const { qa, suite } = await crearEscenarioBase();
  const otro = await crearEscenarioBase();
  const tiposOtroProyecto = await listarTipos(otro.qa.id, otro.proyecto.id);

  const res = await testServer.request('POST', `/api/suites/${suite.id}/casos`, {
    usuarioId: qa.id,
    body: {
      titulo: 'Caso con tipo ajeno',
      prioridad: 'media',
      tipo: 'funcional',
      tipoPruebaId: tiposOtroProyecto[0].id,
      autorId: qa.id,
      pasos: [{ orden: 1, accion: 'Acción', resultadoEsperado: 'Resultado' }],
    },
  });
  assert.equal(res.status, 400);
});

test('filtrar casos por tipoPruebaId (GET) devuelve solo los que coinciden', async () => {
  const { qa, suite, proyecto } = await crearEscenarioBase();
  const tipos = await listarTipos(qa.id, proyecto.id);
  const humo = tipos.find((t) => t.slug === 'humo');
  const funcional = tipos.find((t) => t.slug === 'funcional');

  await crearCaso(qa.id, suite.id, { tipo: 'humo' });
  await crearCaso(qa.id, suite.id, { tipo: 'funcional' });
  await crearCaso(qa.id, suite.id, { tipo: 'funcional' });

  const res = await testServer.request('GET', `/api/suites/${suite.id}/casos?tipoPruebaId=${humo.id}`, { usuarioId: qa.id });
  assert.equal(res.status, 200);
  assert.ok(res.body.data.length >= 1);
  assert.ok(res.body.data.every((c) => c.tipoPruebaId === humo.id));

  const resFuncional = await testServer.request('GET', `/api/suites/${suite.id}/casos?tipoPruebaId=${funcional.id}`, { usuarioId: qa.id });
  assert.ok(resFuncional.body.data.every((c) => c.tipoPruebaId === funcional.id));
});

test('la ejecución conserva el tipo de prueba con el que se creó aunque el caso se re-tipe después (snapshot)', async () => {
  const { qa, proyecto, suite } = await crearEscenarioBase();
  const caso = await crearCaso(qa.id, suite.id, { tipo: 'funcional' });
  await testServer.request('PATCH', `/api/casos/${caso.id}/publicar`, { usuarioId: qa.id });

  const ciclo = await crearCicloPlanificado(qa.id, proyecto.id);
  await testServer.request('PATCH', `/api/ciclos/${ciclo.id}/iniciar`, { usuarioId: qa.id });
  const { data: ejecuciones } = await asignarCasos(qa.id, ciclo.id, [caso.id]);
  const ejecucion = ejecuciones[0];

  const tipos = await listarTipos(qa.id, proyecto.id);
  const funcional = tipos.find((t) => t.slug === 'funcional');
  const regresion = tipos.find((t) => t.slug === 'regresion');
  assert.equal(ejecucion.tipoPruebaId, funcional.id);

  // Re-tipar el caso DESPUÉS de crear la ejecución.
  await testServer.request('PATCH', `/api/casos/${caso.id}`, { usuarioId: qa.id, body: { tipoPruebaId: regresion.id } });

  const ejecucionActualizada = (await testServer.request('GET', `/api/ejecuciones/${ejecucion.id}`, { usuarioId: qa.id })).body;
  assert.equal(ejecucionActualizada.tipoPruebaId, funcional.id, 'la ejecución ya creada no debe cambiar de tipo');

  const casoActualizado = (await testServer.request('GET', `/api/casos/${caso.id}`, { usuarioId: qa.id })).body;
  assert.equal(casoActualizado.tipoPruebaId, regresion.id, 'el caso sí debe reflejar el nuevo tipo');
});

test('filtrar ejecuciones por tipoPruebaId (GET) devuelve solo las que coinciden', async () => {
  const { qa, proyecto, suite } = await crearEscenarioBase();
  const casoHumo = await crearCaso(qa.id, suite.id, { tipo: 'humo' });
  const casoFuncional = await crearCaso(qa.id, suite.id, { tipo: 'funcional' });
  await testServer.request('PATCH', `/api/casos/${casoHumo.id}/publicar`, { usuarioId: qa.id });
  await testServer.request('PATCH', `/api/casos/${casoFuncional.id}/publicar`, { usuarioId: qa.id });

  const ciclo = await crearCicloPlanificado(qa.id, proyecto.id);
  await testServer.request('PATCH', `/api/ciclos/${ciclo.id}/iniciar`, { usuarioId: qa.id });
  await asignarCasos(qa.id, ciclo.id, [casoHumo.id, casoFuncional.id]);

  const tipos = await listarTipos(qa.id, proyecto.id);
  const humo = tipos.find((t) => t.slug === 'humo');

  const res = await testServer.request('GET', `/api/ciclos/${ciclo.id}/ejecuciones?tipoPruebaId=${humo.id}`, { usuarioId: qa.id });
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.data[0].tipoPruebaId, humo.id);
});

test('un defecto creado desde una ejecución hereda su tipo de prueba automáticamente, sin entrada manual', async () => {
  const { qa, proyecto, suite } = await crearEscenarioBase();
  const caso = await crearCaso(qa.id, suite.id, { tipo: 'exploratorio' });
  await testServer.request('PATCH', `/api/casos/${caso.id}/publicar`, { usuarioId: qa.id });

  const ciclo = await crearCicloPlanificado(qa.id, proyecto.id);
  await testServer.request('PATCH', `/api/ciclos/${ciclo.id}/iniciar`, { usuarioId: qa.id });
  const { data: ejecuciones } = await asignarCasos(qa.id, ciclo.id, [caso.id]);
  const ejecucion = ejecuciones[0];

  await cerrarComoFailed(qa.id, ejecucion.id, caso.id);

  // No se manda tipoPruebaId en el body: debe heredarse igualmente de la ejecución.
  const res = await testServer.request('POST', `/api/ejecuciones/${ejecucion.id}/defectos`, {
    usuarioId: qa.id,
    body: { titulo: 'Falla detectada', severidad: 'alta', reportadoPorId: qa.id },
  });
  assert.equal(res.status, 201);

  const tipos = await listarTipos(qa.id, proyecto.id);
  const exploratorio = tipos.find((t) => t.slug === 'exploratorio');
  assert.equal(res.body.tipoPruebaId, exploratorio.id);
});

test('reportar un defecto standalone sin tipoPruebaId devuelve 400', async () => {
  const { qa, proyecto } = await crearEscenarioBase();
  const res = await testServer.request('POST', `/api/proyectos/${proyecto.id}/defectos`, {
    usuarioId: qa.id,
    body: { titulo: 'Defecto sin ejecución de origen', severidad: 'media', reportadoPorId: qa.id },
  });
  assert.equal(res.status, 400);
});

test('reportar un defecto standalone con tipoPruebaId válido lo asigna correctamente', async () => {
  const { qa, proyecto } = await crearEscenarioBase();
  const tipos = await listarTipos(qa.id, proyecto.id);
  const usabilidad = tipos.find((t) => t.slug === 'usabilidad');

  const res = await testServer.request('POST', `/api/proyectos/${proyecto.id}/defectos`, {
    usuarioId: qa.id,
    body: { titulo: 'Defecto exploratorio manual', severidad: 'media', reportadoPorId: qa.id, tipoPruebaId: usabilidad.id },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.tipoPruebaId, usabilidad.id);
  assert.equal(res.body.ejecucionOrigenId, null);
});

test('filtrar defectos por tipoPruebaId (GET) devuelve solo los que coinciden', async () => {
  const { qa, proyecto } = await crearEscenarioBase();
  const tipos = await listarTipos(qa.id, proyecto.id);
  const usabilidad = tipos.find((t) => t.slug === 'usabilidad');
  const accesibilidad = tipos.find((t) => t.slug === 'accesibilidad');

  await testServer.request('POST', `/api/proyectos/${proyecto.id}/defectos`, {
    usuarioId: qa.id,
    body: { titulo: 'D1', severidad: 'media', reportadoPorId: qa.id, tipoPruebaId: usabilidad.id },
  });
  await testServer.request('POST', `/api/proyectos/${proyecto.id}/defectos`, {
    usuarioId: qa.id,
    body: { titulo: 'D2', severidad: 'media', reportadoPorId: qa.id, tipoPruebaId: accesibilidad.id },
  });

  const res = await testServer.request('GET', `/api/proyectos/${proyecto.id}/defectos?tipoPruebaId=${usabilidad.id}`, { usuarioId: qa.id });
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.data[0].titulo, 'D1');
});
