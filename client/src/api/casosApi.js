import { api } from './client';

const toQuery = (params) => {
  const entries = Object.entries(params || {}).filter(([, v]) => v);
  if (!entries.length) return '';
  return `?${new URLSearchParams(entries).toString()}`;
};

export const casosApi = {
  list: (suiteId, filtros) => api.getAll(`/suites/${suiteId}/casos${toQuery(filtros)}`),
  getById: (id) => api.get(`/casos/${id}`),
  create: (suiteId, data) => api.post(`/suites/${suiteId}/casos`, data),
  update: (id, data) => api.patch(`/casos/${id}`, data),
  publicar: (id) => api.patch(`/casos/${id}/publicar`),
  deprecar: (id) => api.patch(`/casos/${id}/deprecar`),
  reactivar: (id) => api.patch(`/casos/${id}/reactivar`),
  remove: (id) => api.delete(`/casos/${id}`),
};
