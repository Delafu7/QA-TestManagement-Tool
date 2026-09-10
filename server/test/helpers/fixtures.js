const { request } = require('./testServer');

let counter = 0;
const unique = (prefix) => `${prefix}-${++counter}-${process.hrtime.bigint()}`;

const crearProyecto = async (overrides = {}) => {
  const { body } = await request('POST', '/api/proyectos', {
    body: { nombre: unique('Proyecto'), ...overrides },
  });
  return body;
};

const crearSuite = async (proyectoId, overrides = {}) => {
  const { body } = await request('POST', `/api/proyectos/${proyectoId}/suites`, {
    body: { nombre: unique('Suite'), ...overrides },
  });
  return body;
};

const pasoDefault = () => [{ orden: 1, accion: 'Hacer algo', resultadoEsperado: 'Pasa algo' }];

const crearCaso = async (suiteId, overrides = {}) => {
  const { body } = await request('POST', `/api/suites/${suiteId}/casos`, {
    body: {
      titulo: unique('Caso'),
      prioridad: 'media',
      tipo: 'funcional',
      pasos: pasoDefault(),
      ...overrides,
    },
  });
  return body;
};

const publicarCaso = async (casoId) => (await request('PATCH', `/api/casos/${casoId}/publicar`)).body;

const crearCicloPlanificado = async (proyectoId, overrides = {}) => {
  const { body } = await request('POST', `/api/proyectos/${proyectoId}/ciclos`, {
    body: {
      nombre: unique('Ciclo'),
      fechaInicio: '2026-01-01',
      fechaFinPrevista: '2026-01-31',
      ...overrides,
    },
  });
  return body;
};

const asignarCasos = async (cicloId, casoIds) =>
  (await request('POST', `/api/ciclos/${cicloId}/casos`, { body: { casoIds } })).body;

// Escenario completo: proyecto, suite y un caso ya publicado (activo).
const crearEscenarioBase = async () => {
  const proyecto = await crearProyecto();
  const suite = await crearSuite(proyecto.id);
  const caso = await crearCaso(suite.id);
  await publicarCaso(caso.id);
  return { proyecto, suite, caso };
};

// Escenario con un ciclo en_progreso y una ejecución pendiente para el caso dado.
const crearEjecucionPendiente = async (proyectoId, casoId) => {
  const ciclo = await crearCicloPlanificado(proyectoId);
  await request('PATCH', `/api/ciclos/${ciclo.id}/iniciar`);
  const { data: ejecuciones } = await asignarCasos(ciclo.id, [casoId]);
  return { ciclo, ejecucion: ejecuciones[0] };
};

module.exports = {
  unique,
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
