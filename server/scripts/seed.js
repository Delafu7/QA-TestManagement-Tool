// Rellena la base de datos configurada (SQLITE_DB_PATH, o server/data/qa-tool.sqlite
// por defecto) con datos de ejemplo realistas para poder probar la aplicación a mano:
// usuarios, un proyecto, suites, etiquetas, casos, dos ciclos con ejecuciones cerradas
// y pendientes, y defectos en distintos estados. Node: node scripts/seed.js

const usuariosService = require('../src/services/usuarios.service');
const proyectosService = require('../src/services/proyectos.service');
const suitesService = require('../src/services/suites.service');
const etiquetasService = require('../src/services/etiquetas.service');
const casosService = require('../src/services/casos.service');
const ciclosService = require('../src/services/ciclos.service');
const ejecucionesService = require('../src/services/ejecuciones.service');
const defectosService = require('../src/services/defectos.service');
const usuariosModel = require('../src/models/usuarios.model');

function cerrarEjecucion(ejecucionId, ejecutorId, estado, duracionSegundos, pasos) {
  ejecucionesService.tomar(ejecucionId, ejecutorId);
  return ejecucionesService.registrarResultado(ejecucionId, {
    estado,
    duracionSegundos,
    resultadosPaso: pasos.map((p, i) => ({
      pasoId: p.id,
      estado: estado === 'passed' ? 'pass' : i === pasos.length - 1 ? 'fail' : 'pass',
    })),
  });
}

function main() {
  if (usuariosModel.list().length > 0) {
    console.error(
      'La base de datos ya tiene usuarios. Para no duplicar datos, este script solo se ejecuta sobre una base vacía.\n' +
        'Borra el archivo .sqlite (o usa SQLITE_DB_PATH=/ruta/nueva.sqlite node scripts/seed.js) y vuelve a intentarlo.'
    );
    process.exitCode = 1;
    return;
  }

  const ana = usuariosService.create({ nombre: 'Ana García', email: 'ana@qa-tool.local', rol: 'qa' });
  const carlos = usuariosService.create({ nombre: 'Carlos Ruiz', email: 'carlos@qa-tool.local', rol: 'qa' });
  const marta = usuariosService.create({ nombre: 'Marta López', email: 'marta@qa-tool.local', rol: 'gestor' });

  const proyecto = proyectosService.create({
    nombre: 'App Móvil Banca',
    descripcion: 'App de banca móvil: login, pagos y perfil de usuario.',
    propietarioId: marta.id,
  });

  const suiteAuth = suitesService.create({ proyectoId: proyecto.id, nombre: 'Auth' });
  const suiteLogin = suitesService.create({ proyectoId: proyecto.id, nombre: 'Login', suitePadreId: suiteAuth.id });
  const suitePagos = suitesService.create({ proyectoId: proyecto.id, nombre: 'Pagos' });
  const suitePerfil = suitesService.create({ proyectoId: proyecto.id, nombre: 'Perfil' });

  const etSmoke = etiquetasService.create({ proyectoId: proyecto.id, nombre: 'smoke', color: '#4F46E5' });
  const etCritico = etiquetasService.create({ proyectoId: proyecto.id, nombre: 'critico', color: '#DC2626' });
  const etRegresion = etiquetasService.create({ proyectoId: proyecto.id, nombre: 'regresion', color: '#059669' });

  const crearCaso = (suiteId, titulo, prioridad, tipo, autorId, pasos, etiquetaIds = []) =>
    casosService.create({ suiteId, titulo, prioridad, tipo, autorId, etiquetaIds, pasos });

  const cLogin = crearCaso(
    suiteLogin.id,
    'Login con credenciales válidas',
    'alta',
    'funcional',
    ana.id,
    [
      { orden: 1, accion: 'Introducir email y contraseña válidos', resultadoEsperado: 'Los campos aceptan la entrada' },
      { orden: 2, accion: 'Pulsar "Entrar"', resultadoEsperado: 'Se redirige al dashboard' },
    ],
    [etSmoke.id, etCritico.id]
  );
  const cLoginMal = crearCaso(
    suiteLogin.id,
    'Login con contraseña incorrecta',
    'media',
    'funcional',
    ana.id,
    [{ orden: 1, accion: 'Introducir contraseña incorrecta y pulsar "Entrar"', resultadoEsperado: 'Muestra error, no redirige' }]
  );
  const cRecuperar = crearCaso(
    suiteLogin.id,
    'Recuperar contraseña por email',
    'media',
    'funcional',
    carlos.id,
    [
      { orden: 1, accion: 'Pulsar "¿Olvidaste tu contraseña?"', resultadoEsperado: 'Pide el email' },
      { orden: 2, accion: 'Introducir email registrado', resultadoEsperado: 'Se envía correo de recuperación' },
    ]
  );
  const cBloqueo = crearCaso(
    suiteLogin.id,
    'Bloqueo tras 5 intentos fallidos',
    'alta',
    'regresion',
    ana.id,
    [{ orden: 1, accion: 'Fallar el login 5 veces seguidas', resultadoEsperado: 'La cuenta queda bloqueada 15 minutos' }],
    [etRegresion.id]
  );
  const cLogout = crearCaso(
    suiteLogin.id,
    'Cierre de sesión automático por inactividad',
    'media',
    'humo',
    carlos.id,
    [{ orden: 1, accion: 'Dejar la app inactiva 10 minutos', resultadoEsperado: 'Se cierra la sesión automáticamente' }],
    [etSmoke.id]
  );
  const cTransferencia = crearCaso(
    suitePagos.id,
    'Transferencia entre cuentas propias',
    'alta',
    'funcional',
    carlos.id,
    [
      { orden: 1, accion: 'Seleccionar cuenta origen y destino propias', resultadoEsperado: 'Se muestran ambas cuentas' },
      { orden: 2, accion: 'Introducir importe con decimales y confirmar', resultadoEsperado: 'La transferencia se realiza correctamente' },
    ],
    [etCritico.id]
  );
  const cTarjeta = crearCaso(
    suitePagos.id,
    'Pago con tarjeta guardada',
    'media',
    'funcional',
    carlos.id,
    [{ orden: 1, accion: 'Seleccionar tarjeta guardada y confirmar pago', resultadoEsperado: 'El pago se procesa sin pedir datos de nuevo' }]
  );
  const cEditarPerfil = crearCaso(
    suitePerfil.id,
    'Editar datos de perfil',
    'baja',
    'funcional',
    ana.id,
    [{ orden: 1, accion: 'Cambiar nombre y guardar', resultadoEsperado: 'El nuevo nombre se refleja en el perfil' }]
  );
  const cFoto = crearCaso(
    suitePerfil.id,
    'Cambiar foto de perfil',
    'baja',
    'exploratorio',
    ana.id,
    [{ orden: 1, accion: 'Subir una nueva foto de perfil', resultadoEsperado: 'La foto se actualiza correctamente' }]
  );
  const cHuella = crearCaso(
    suiteLogin.id,
    'Login vía huella dactilar (dispositivo antiguo)',
    'baja',
    'funcional',
    carlos.id,
    [{ orden: 1, accion: 'Autenticar con huella en un dispositivo sin sensor', resultadoEsperado: 'Cae a login por contraseña' }]
  );

  // Estados variados para poder probar filtros: la mayoría activos, uno en
  // borrador (todavía no publicado) y uno obsoleto (deprecado).
  [cLogin, cLoginMal, cRecuperar, cBloqueo, cLogout, cTransferencia, cTarjeta, cEditarPerfil, cHuella].forEach((c) =>
    casosService.publicar(c.id)
  );
  casosService.deprecar(cHuella.id);
  // cFoto se deja en 'borrador' a propósito.

  // --- Sprint 13 — Regresión (completada) ---
  const sprint13 = ciclosService.create({
    proyectoId: proyecto.id,
    nombre: 'Sprint 13 — Regresión',
    fechaInicio: '2026-08-01',
    fechaFinPrevista: '2026-08-07',
    responsableId: marta.id,
  });
  ciclosService.iniciar(sprint13.id);
  const ejecs13 = ciclosService.asignarCasos(sprint13.id, [
    cLogin.id,
    cLoginMal.id,
    cRecuperar.id,
    cTransferencia.id,
    cTarjeta.id,
    cEditarPerfil.id,
  ]);
  const buscarEjec = (ejecs, casoId) => ejecs.find((e) => e.casoId === casoId);
  const pasosDe = (caso) => casosService.getById(caso.id).pasos;

  const ejecLoginFail13 = cerrarEjecucion(buscarEjec(ejecs13, cLogin.id).id, ana.id, 'failed', 95, pasosDe(cLogin));
  cerrarEjecucion(buscarEjec(ejecs13, cLoginMal.id).id, ana.id, 'passed', 40, pasosDe(cLoginMal));
  cerrarEjecucion(buscarEjec(ejecs13, cRecuperar.id).id, carlos.id, 'passed', 60, pasosDe(cRecuperar));
  cerrarEjecucion(buscarEjec(ejecs13, cTransferencia.id).id, carlos.id, 'passed', 130, pasosDe(cTransferencia));
  cerrarEjecucion(buscarEjec(ejecs13, cTarjeta.id).id, carlos.id, 'blocked', 20, pasosDe(cTarjeta));
  cerrarEjecucion(buscarEjec(ejecs13, cEditarPerfil.id).id, ana.id, 'passed', 35, pasosDe(cEditarPerfil));
  ciclosService.completar(sprint13.id);

  // --- Sprint 14 — Regresión (en_progreso) ---
  const sprint14 = ciclosService.create({
    proyectoId: proyecto.id,
    nombre: 'Sprint 14 — Regresión',
    fechaInicio: '2026-08-18',
    fechaFinPrevista: '2026-08-25',
    responsableId: marta.id,
  });
  ciclosService.iniciar(sprint14.id);
  const ejecs14 = ciclosService.asignarCasos(sprint14.id, [
    cLogin.id,
    cLoginMal.id,
    cBloqueo.id,
    cLogout.id,
    cTransferencia.id,
  ]);
  cerrarEjecucion(buscarEjec(ejecs14, cLogin.id).id, ana.id, 'passed', 50, pasosDe(cLogin));
  const ejecBloqueoFail14 = cerrarEjecucion(buscarEjec(ejecs14, cBloqueo.id).id, ana.id, 'failed', 210, pasosDe(cBloqueo));
  cerrarEjecucion(buscarEjec(ejecs14, cTransferencia.id).id, carlos.id, 'passed', 140, pasosDe(cTransferencia));
  // cLoginMal y cLogout se dejan 'pendiente' para poder probar el flujo de ejecución.

  // --- Defectos, en distintos estados del ciclo de vida ---
  const defLogin = defectosService.createFromEjecucion(ejecLoginFail13.id, {
    titulo: 'Login no redirige tras éxito',
    descripcion: 'Falla en el paso 2: la sesión se crea pero la app se queda en la pantalla de login.',
    severidad: 'alta',
    reportadoPorId: ana.id,
  });
  defectosService.asignar(defLogin.id);
  defectosService.resolver(defLogin.id);
  defectosService.verificar(defLogin.id); // cerrado

  const defBloqueo = defectosService.createFromEjecucion(ejecBloqueoFail14.id, {
    titulo: 'El bloqueo tras 5 intentos no persiste entre sesiones',
    descripcion: 'Reiniciando la app se puede volver a intentar sin esperar los 15 minutos.',
    severidad: 'critica',
    reportadoPorId: ana.id,
  });
  defectosService.asignar(defBloqueo.id); // en_progreso

  defectosService.createFromEjecucion(ejecBloqueoFail14.id, {
    titulo: 'Mensaje de bloqueo poco claro para el usuario',
    descripcion: 'El texto de error no indica cuánto tiempo queda de bloqueo.',
    severidad: 'baja',
    reportadoPorId: carlos.id,
  }); // abierto

  console.log('Datos de ejemplo creados correctamente:');
  console.log(`  Usuarios: ${ana.nombre} (qa), ${carlos.nombre} (qa), ${marta.nombre} (gestor)`);
  console.log(`  Proyecto: ${proyecto.nombre} (${proyecto.id})`);
  console.log('  4 suites, 3 etiquetas, 10 casos de prueba (uno en borrador, uno obsoleto)');
  console.log('  2 ciclos: Sprint 13 (completada) y Sprint 14 (en_progreso, con ejecuciones pendientes)');
  console.log('  3 defectos: uno cerrado, uno en_progreso, uno abierto');
}

main();
