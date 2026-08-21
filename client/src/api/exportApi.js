import { api, ApiError } from './client';

const BASE = '/api';

function usuarioHeaders() {
  const id = localStorage.getItem('qa-tool:usuarioId');
  return id ? { 'X-User-Id': id } : {};
}

function filenameFromDisposition(disposition, fallback) {
  const match = /filename="([^"]+)"/.exec(disposition || '');
  return match ? match[1] : fallback;
}

async function downloadFile(path, fallbackName) {
  const res = await fetch(`${BASE}${path}`, { headers: usuarioHeaders() });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const err = payload?.error || {};
    throw new ApiError(res.status, err.code || 'UNKNOWN', err.message || 'Error al exportar', err.details);
  }
  const blob = await res.blob();
  const filename = filenameFromDisposition(res.headers.get('content-disposition'), fallbackName);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const exportApi = {
  getJson: (cicloId) => api.get(`/ciclos/${cicloId}/export/json`),
  downloadJson: (cicloId) => downloadFile(`/ciclos/${cicloId}/export/json`, 'resultados.json'),
  downloadMarkdown: (cicloId) => downloadFile(`/ciclos/${cicloId}/export/markdown`, 'resultados.md'),
  sendToNotion: (cicloId, { notionDatabaseId, notionToken }) =>
    api.post(`/ciclos/${cicloId}/export/notion`, { notionDatabaseId, notionToken }),
};
