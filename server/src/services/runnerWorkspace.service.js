const fs = require('fs');
const path = require('path');
const runnerConfig = require('../config/runner');
const { badRequest } = require('../utils/errors');

// Resuelve la raíz configurada a su ruta real (sin symlinks) una vez por
// llamada: RUNNER_WORKSPACE_ROOT puede cambiar entre tests, así que no se
// cachea a nivel de módulo.
const getRoot = () => {
  const configured = runnerConfig.workspaceRoot();
  if (!configured) throw badRequest('RUNNER_WORKSPACE_ROOT no está configurado');
  return fs.realpathSync(configured);
};

// `relativePath` es siempre relativo a la raíz del workspace ('' == la raíz
// misma). Nunca se acepta ni se produce una ruta absoluta hacia el cliente:
// así el cliente solo puede llevar estado relativo, sin forma de "recordar"
// una ruta absoluta del servidor.
const resolveDentroDeRaiz = (relativePath) => {
  const root = getRoot();
  const relative = relativePath || '.';

  if (path.isAbsolute(relative)) throw badRequest('La ruta debe ser relativa a la raíz del workspace');
  if (relative.includes('\0')) throw badRequest('Ruta inválida');

  const resolved = path.resolve(root, relative);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw badRequest('La ruta sale de la raíz del workspace');
  }
  if (!fs.existsSync(resolved)) throw badRequest('La ruta no existe');

  // Repite la comprobación de contención sobre la ruta real: un symlink
  // dentro del árbol permitido puede apuntar fuera de él.
  const real = fs.realpathSync(resolved);
  if (real !== root && !real.startsWith(root + path.sep)) {
    throw badRequest('La ruta (o un symlink dentro de ella) sale de la raíz del workspace');
  }

  return { absolute: real, relative: real === root ? '' : path.relative(root, real) };
};

const pwd = (relativePath) => resolveDentroDeRaiz(relativePath).relative;

const ls = (relativePath) => {
  const { absolute, relative } = resolveDentroDeRaiz(relativePath);
  if (!fs.statSync(absolute).isDirectory()) throw badRequest('La ruta no es un directorio');
  const entradas = fs
    .readdirSync(absolute, { withFileTypes: true })
    .map((e) => ({ nombre: e.name, tipo: e.isDirectory() ? 'directorio' : 'archivo' }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  return { directorio: relative, entradas };
};

const cd = (relativePath, segmento) => {
  const destino = segmento ? path.join(relativePath || '.', segmento) : relativePath;
  const { absolute, relative } = resolveDentroDeRaiz(destino);
  if (!fs.statSync(absolute).isDirectory()) throw badRequest('El destino no es un directorio');
  return relative;
};

const resolveCwdAbsoluto = (relativePath) => resolveDentroDeRaiz(relativePath).absolute;

module.exports = { pwd, ls, cd, resolveCwdAbsoluto };
