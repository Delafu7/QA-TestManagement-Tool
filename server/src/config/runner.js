// Todo lo relativo al runner es opt-in y apagado por defecto (ver README "Not
// built for"): sin RUNNER_ENABLED=true y una raíz configurada, las rutas del
// runner devuelven 501 antes de tocar el sistema de archivos o crear ningún proceso.
const isEnabled = () => process.env.RUNNER_ENABLED === 'true' && !!process.env.RUNNER_WORKSPACE_ROOT;

const workspaceRoot = () => process.env.RUNNER_WORKSPACE_ROOT;

const timeoutMs = () => Number(process.env.RUNNER_TIMEOUT_MS) || 10 * 60 * 1000;

const outputCapBytes = () => Number(process.env.RUNNER_OUTPUT_CAP_BYTES) || 2 * 1024 * 1024;

// Lista blanca de comandos ejecutables (08-decisiones.md style: config explícita,
// no lo que el cliente mande). El cliente solo puede elegir un `id` de esta lista
// y, opcionalmente, argumentos extra que se validan aparte (ver runnerProceso.service.js).
// Ampliar esta lista es una decisión consciente de superficie de ataque, no un
// detalle de implementación: cada entrada nueva es un binario que este servidor
// ejecutará bajo demanda.
const ALLOWED_COMMANDS = [
  { id: 'npm-test', bin: 'npm', baseArgs: ['test'], label: 'npm test' },
  { id: 'npm-run-test', bin: 'npm', baseArgs: ['run', 'test'], label: 'npm run test' },
];

const findCommand = (id) => ALLOWED_COMMANDS.find((c) => c.id === id) || null;

// Entorno mínimo explícito para los procesos hijo: nunca se copia
// `process.env` completo (evita filtrar el token de Notion u otros secretos
// del proceso del servidor a un comando de test arbitrario).
const childEnv = () => ({
  PATH: process.env.PATH,
  HOME: process.env.HOME || '/root',
  LANG: process.env.LANG || 'en_US.UTF-8',
});

// Middleware de Express. Vive aquí (no en server/src/middleware/) porque esta
// tarea solo puede tocar server/src/config/ para código transversal nuevo.
const requireRunnerEnabled = (req, res, next) => {
  if (!isEnabled()) {
    return res.status(501).json({
      error: { code: 'RUNNER_DISABLED', message: 'El runner de terminal no está habilitado en este servidor', details: {} },
    });
  }
  next();
};

module.exports = {
  isEnabled,
  workspaceRoot,
  timeoutMs,
  outputCapBytes,
  ALLOWED_COMMANDS,
  findCommand,
  childEnv,
  requireRunnerEnabled,
};
