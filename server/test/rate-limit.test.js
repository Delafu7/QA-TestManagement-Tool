const test = require('node:test');
const assert = require('node:assert/strict');

// El límite de la app real es 300 req/min (server/src/middleware/rateLimit.middleware.js),
// demasiado alto para probarlo en un test rápido. Este archivo arranca su propia instancia
// de la app con un límite bajo vía variables de entorno, para poder disparar un 429 real.
process.env.RATE_LIMIT_WINDOW_MS = '60000';
process.env.RATE_LIMIT_MAX = '3';

const testServer = require('./helpers/testServer');
const { crearUsuario } = require('./helpers/fixtures');

test.before(testServer.start);
test.after(testServer.stop);

test('supera el límite de peticiones y devuelve 429 con el código RATE_LIMITED', async () => {
  const qa = await crearUsuario('qa'); // ya consume 1 petición del límite (POST /api/usuarios)

  const restantes = [];
  for (let i = 0; i < 5; i += 1) {
    restantes.push(await testServer.request('GET', '/api/proyectos', { usuarioId: qa.id }));
  }

  const estados = restantes.map((r) => r.status);
  assert.ok(estados.includes(429), `esperaba al menos un 429 entre ${JSON.stringify(estados)}`);

  const limitado = restantes.find((r) => r.status === 429);
  assert.equal(limitado.body.error.code, 'RATE_LIMITED');
});
