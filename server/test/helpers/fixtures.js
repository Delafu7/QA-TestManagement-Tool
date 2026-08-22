const { request } = require('./testServer');

let counter = 0;
const unique = (prefix) => `${prefix}-${++counter}-${process.hrtime.bigint()}`;

const crearUsuario = async (rol = 'qa') => {
  const { body } = await request('POST', '/api/usuarios', {
    body: { nombre: `Usuario ${unique(rol)}`, email: `${unique('user')}@example.com`, rol },
  });
  return body;
};

const crearProyecto = async (usuarioId, overrides = {}) => {
  const { body } = await request('POST', '/api/proyectos', {
    usuarioId,
    body: { nombre: unique('Proyecto'), propietarioId: usuarioId, ...overrides },
  });
  return body;
};

const crearSuite = async (usuarioId, proyectoId, overrides = {}) => {
  const { body } = await request('POST', `/api/proyectos/${proyectoId}/suites`, {
    usuarioId,
    body: { nombre: unique('Suite'), ...overrides },
  });
  return body;
};

const pasoDefault = () => [{ orden: 1, accion: 'Hacer algo', resultadoEsperado: 'Pasa algo' }];

const crearCaso = async (usuarioId, suiteId, overrides = {}) => {
  const { body } = await request('POST', `/api/suites/${suiteId}/casos`, {
    usuarioId,
    body: {
      titulo: unique('Caso'),
      prioridad: 'media',
      tipo: 'funcional',
      autorId: usuarioId,
      pasos: pasoDefault(),
      ...overrides,
    },
  });
  return body;
};

const publicarCaso = async (usuarioId, casoId) => (await request('PATCH', `/api/casos/${casoId}/publicar`, { usuarioId })).body;

const crearCicloPlanificado = async (usuarioId, proyectoId, overrides = {}) => {
  const { body } = await request('POST', `/api/proyectos/${proyectoId}/ciclos`, {
    usuarioId,
    body: {
      nombre: unique('Ciclo'),
      fechaInicio: '2026-01-01',
      fechaFinPrevista: '2026-01-31',
      responsableId: usuarioId,
      ...overrides,
    },
  });
  return body;
};

const asignarCasos = async (usuarioId, cicloId, casoIds) =>
  (await request('POST', `/api/ciclos/${cicloId}/casos`, { usuarioId, body: { casoIds } })).body;

// Escenario completo: usuarios qa+gestor, proyecto, suite y un caso ya publicado (activo).
const crearEscenarioBase = async () => {
  const qa = await crearUsuario('qa');
  const gestor = await crearUsuario('gestor');
  const proyecto = await crearProyecto(qa.id);
  const suite = await crearSuite(qa.id, proyecto.id);
  const caso = await crearCaso(qa.id, suite.id);
  await publicarCaso(qa.id, caso.id);
  return { qa, gestor, proyecto, suite, caso };
};

// Escenario con un ciclo en_progreso y una ejecución pendiente para el caso dado.
const crearEjecucionPendiente = async (qaId, proyectoId, casoId) => {
  const ciclo = await crearCicloPlanificado(qaId, proyectoId);
  await request('PATCH', `/api/ciclos/${ciclo.id}/iniciar`, { usuarioId: qaId });
  const { data: ejecuciones } = await asignarCasos(qaId, ciclo.id, [casoId]);
  return { ciclo, ejecucion: ejecuciones[0] };
};

module.exports = {
  unique,
  crearUsuario,
  crearProyecto,
  crearSuite,
  crearCaso,
  publicarCaso,
  crearCicloPlanificado,
  asignarCasos,
  crearEscenarioBase,
  crearEjecucionPendiente,
  pasoDefault,
};
