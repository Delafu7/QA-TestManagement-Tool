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

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),
};
