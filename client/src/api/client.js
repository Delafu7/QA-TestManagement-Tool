const BASE = '/api';

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let usuarioId = null;

export function setUsuarioId(id) {
  usuarioId = id;
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (usuarioId) headers['X-User-Id'] = usuarioId;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const contentType = res.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const err = payload?.error || {};
    throw new ApiError(res.status, err.code || 'UNKNOWN', err.message || 'Error de red', err.details);
  }

  return payload;
}

function withQuery(path, params) {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${new URLSearchParams(params).toString()}`;
}

// Los endpoints de listado ahora paginan (server/docs/design/03-api-contract.md):
// una sola página ya no es "todo lo que hay". Las pantallas actuales no tienen
// controles de paginación propios y esperan la lista completa, así que este
// helper pagina por debajo hasta reunirla, en vez de dejar que cada pantalla
// trunque silenciosamente en la página 1 (ver docs/AUDIT.md, Riesgo #5).
const AUTO_PAGE_SIZE = 100;

async function getAll(path) {
  let page = 1;
  let data = [];
  let total = Infinity;
  while (data.length < total) {
    const res = await request('GET', withQuery(path, { page, pageSize: AUTO_PAGE_SIZE }));
    data = data.concat(res.data);
    total = res.pagination ? res.pagination.total : data.length;
    if (res.data.length === 0) break; // salvaguarda: nunca debería pasar si total es correcto
    page += 1;
  }
  return { data, pagination: { page: 1, pageSize: data.length, total } };
}

// Para cuando solo hace falta un recuento (ej. un KPI), sin traer todas las filas.
async function count(path) {
  const res = await request('GET', withQuery(path, { page: 1, pageSize: 1 }));
  return res.pagination ? res.pagination.total : (res.data || []).length;
}

// Consumo manual de un endpoint Server-Sent Events con fetch en vez de
// EventSource: EventSource no permite mandar cabeceras propias, y esta app
// autentica todo por X-User-Id (ver docs/ARCHITECTURE.md#authentication-model).
// El formato en el cable sigue siendo SSE estándar (`event:`/`data:`); esto
// solo cambia cómo se lee en el cliente. Devuelve un AbortController para que
// el llamador pueda cortar la conexión (p.ej. al desmontar o al lanzar otra).
function stream(path, onEvent) {
  const headers = {};
  if (usuarioId) headers['X-User-Id'] = usuarioId;
  const controller = new AbortController();

  (async () => {
    const res = await fetch(`${BASE}${path}`, { headers, signal: controller.signal });
    if (!res.ok || !res.body) {
      onEvent({ event: 'error', data: { message: `Error de red (${res.status})` } });
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const lines = frame.split('\n');
        const eventLine = lines.find((l) => l.startsWith('event: '));
        const dataLine = lines.find((l) => l.startsWith('data: '));
        if (dataLine) onEvent({ event: eventLine ? eventLine.slice(7) : 'message', data: JSON.parse(dataLine.slice(6)) });
      }
    }
  })().catch((err) => {
    if (err.name !== 'AbortError') onEvent({ event: 'error', data: { message: err.message } });
  });

  return controller;
}

export const api = {
  get: (path) => request('GET', path),
  getAll: (path) => getAll(path),
  count: (path) => count(path),
  post: (path, body) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),
  stream: (path, onEvent) => stream(path, onEvent),
};
