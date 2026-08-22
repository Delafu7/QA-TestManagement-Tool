const path = require('path');
const os = require('os');

// Cada archivo de test corre en su propio proceso (aislamiento por defecto de
// `node --test`), así que fijar estas variables aquí, antes de requerir la app,
// es seguro: no hay otro archivo de test compartiendo este proceso ni esta BD.
process.env.SQLITE_DB_PATH = ':memory:';
process.env.LOG_FILE_PATH = path.join(os.tmpdir(), `qa-tool-test-${process.pid}.ndjson`);

const app = require('../../src/app');

let server;
let baseUrl;

const start = () =>
  new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve(baseUrl);
    });
  });

const stop = () => new Promise((resolve) => server.close(resolve));

const request = (method, urlPath, { usuarioId, body } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (usuarioId) headers['X-User-Id'] = usuarioId;
  return fetch(`${baseUrl}${urlPath}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).then(async (res) => {
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null; // respuesta no-JSON (ej. export Markdown): queda disponible en `text`
    }
    return { status: res.status, body: json, text };
  });
};

module.exports = { start, stop, request };
