const test = require('node:test');
const assert = require('node:assert/strict');

const { slugify } = require('../src/utils/slug');
const { newId, now } = require('../src/utils/ids');
const { AppError, badRequest, unauthorized, forbidden, notFound, conflict, unprocessable } = require('../src/utils/errors');

test('slugify: minúsculas, sin acentos, espacios a guiones', () => {
  assert.equal(slugify('App Móvil Banca'), 'app-movil-banca');
});

test('slugify: colapsa separadores no alfanuméricos y recorta guiones extremos', () => {
  assert.equal(slugify('Sprint 14 — Regresión!!'), 'sprint-14-regresion');
});

test('newId genera UUIDs v4 distintos', () => {
  const a = newId();
  const b = newId();
  assert.notEqual(a, b);
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test('now() devuelve fecha ISO 8601 en UTC', () => {
  assert.match(now(), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test('errores: cada helper produce el statusCode y code esperados', () => {
  assert.equal(badRequest('x').statusCode, 400);
  assert.equal(unauthorized().statusCode, 401);
  assert.equal(forbidden().statusCode, 403);
  assert.equal(notFound('Caso').statusCode, 404);
  assert.equal(notFound('Caso').message, 'Caso no encontrado');
  const c = conflict('INVALID_TRANSITION', 'no se puede');
  assert.equal(c.statusCode, 409);
  assert.equal(c.code, 'INVALID_TRANSITION');
  const u = unprocessable('CASO_CON_EJECUCIONES', 'bloqueado');
  assert.equal(u.statusCode, 422);
  assert.ok(u instanceof AppError);
});
