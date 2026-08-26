const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const runnerConfig = require('../config/runner');
const { badRequest } = require('../utils/errors');

// El cliente nunca manda un comando en texto libre: solo un `commandId` de la
// lista blanca (server/src/config/runner.js). No se aceptan argumentos extra
// del cliente: un patrón de caracteres "seguros" (letras, `/`, `=`, `-`...) no
// basta para evitar que un argumento cambie el comportamiento del binario en
// sí. Por ejemplo `npm test --prefix <ruta-fuera-del-workspace>` no usa `..`
// ni metacaracteres de shell y aun así hace que npm ejecute el script `test`
// de un `package.json` completamente distinto, fuera de la raíz jaileada —
// derrotando el sandbox de directorios sin tocar en ningún momento
// `directorioRelativo`. Enumerar qué flags son "seguras" para cada binario es
// una lista negra encubierta (y npm por sí solo ya tiene decenas: --prefix,
// --userconfig, --globalconfig, --script-shell...), así que en vez de eso no
// se permite ningún argumento más allá de los fijados en `baseArgs`. Si en el
// futuro un comando necesita argumentos variables, la extensión correcta es
// una lista explícita de patrones de flag permitidos por `commandId`, no un
// patrón de caracteres genérico.
const validarComando = (commandId, argumentosExtra) => {
  const comando = runnerConfig.findCommand(commandId);
  if (!comando) throw badRequest('commandId no está en la lista blanca de comandos permitidos');
  if (argumentosExtra && argumentosExtra.length > 0) {
    throw badRequest('Este comando no admite argumentos adicionales', { argumentosExtra });
  }
  return { bin: comando.bin, args: [...comando.baseArgs] };
};

// runId -> { emitter, child, abortado, timedOut, cerrado, timeoutHandle }
const enCurso = new Map();

// Muchos comandos de test (empezando por `npm test`) ejecutan el script real a
// través de un hijo propio (p.ej. `sh -c "..."`); `child.kill()` solo señala al
// proceso directo (npm) y deja huérfano a ese nieto, que sigue corriendo para
// siempre. Por eso se lanza con `detached: true` (líder de su propio grupo de
// procesos) y se señala con `process.kill(-pid, signal)`, que llega a todo el
// árbol. Se ignora ESRCH: el grupo ya puede haber terminado.
const matarGrupo = (child, signal) => {
  try {
    process.kill(-child.pid, signal);
  } catch {
    // ya no existe; nada que matar.
  }
};

const iniciarProceso = ({ runId, bin, args, cwd }) => {
  const emitter = new EventEmitter();
  const cap = runnerConfig.outputCapBytes();

  // `salida`/`truncada` viven en `entry` (no solo en este closure) para que un
  // cliente SSE que se suscribe tarde pueda leer lo ya generado antes de
  // engancharse a los próximos eventos 'chunk' (ver snapshot()).
  const entry = { emitter, child: null, abortado: false, timedOut: false, cerrado: false, timeoutHandle: null, salida: '', truncada: false };
  enCurso.set(runId, entry);

  const append = (chunk) => {
    const texto = chunk.toString('utf8');
    emitter.emit('chunk', texto);
    if (entry.truncada) return;
    if (entry.salida.length + texto.length > cap) {
      entry.salida += texto.slice(0, Math.max(0, cap - entry.salida.length));
      entry.truncada = true;
      return;
    }
    entry.salida += texto;
  };

  const child = spawn(bin, args, { cwd, shell: false, env: runnerConfig.childEnv(), detached: true });
  entry.child = child;
  child.stdout.on('data', append);
  child.stderr.on('data', append);

  entry.timeoutHandle = setTimeout(() => {
    entry.timedOut = true;
    matarGrupo(child, 'SIGTERM');
    setTimeout(() => {
      if (!entry.cerrado) matarGrupo(child, 'SIGKILL');
    }, 2000).unref();
  }, runnerConfig.timeoutMs());
  entry.timeoutHandle.unref();

  const finalizar = (estadoForzado, codigoSalida, mensajeExtra) => {
    clearTimeout(entry.timeoutHandle);
    entry.cerrado = true;
    const estado = estadoForzado || (entry.abortado ? 'cancelado' : entry.timedOut ? 'timeout' : codigoSalida === 0 ? 'passed' : 'failed');
    const salidaFinal = mensajeExtra ? `${entry.salida}\n${mensajeExtra}` : entry.salida;
    emitter.emit('end', { estado, codigoSalida, salida: salidaFinal, salidaTruncada: entry.truncada });
    enCurso.delete(runId);
  };

  child.on('close', (code) => finalizar(null, code));
  child.on('error', (err) => finalizar('failed', null, `[error al lanzar el proceso: ${err.message}]`));

  return { emitter };
};

const abortar = (runId) => {
  const entry = enCurso.get(runId);
  if (!entry) return false;
  entry.abortado = true;
  matarGrupo(entry.child, 'SIGTERM');
  setTimeout(() => {
    if (!entry.cerrado) matarGrupo(entry.child, 'SIGKILL');
  }, 2000).unref();
  return true;
};

const suscribir = (runId, { onChunk, onEnd } = {}) => {
  const entry = enCurso.get(runId);
  if (!entry) return null;
  if (onChunk) entry.emitter.on('chunk', onChunk);
  if (onEnd) entry.emitter.on('end', onEnd);
  return entry;
};

const desuscribir = (runId, { onChunk, onEnd } = {}) => {
  const entry = enCurso.get(runId);
  if (!entry) return;
  if (onChunk) entry.emitter.off('chunk', onChunk);
  if (onEnd) entry.emitter.off('end', onEnd);
};

const estaEnCurso = (runId) => enCurso.has(runId);

// Para un cliente SSE que se suscribe cuando el proceso ya lleva un rato
// corriendo: lo que ya se generó, para pintarlo antes de engancharse a los
// próximos 'chunk'. Lectura síncrona, sin ceder el hilo, así que no hay
// carrera entre leer esto y suscribirse a continuación.
const snapshot = (runId) => {
  const entry = enCurso.get(runId);
  return entry ? { salida: entry.salida, salidaTruncada: entry.truncada } : null;
};

module.exports = { validarComando, iniciarProceso, abortar, suscribir, desuscribir, estaEnCurso, snapshot };
