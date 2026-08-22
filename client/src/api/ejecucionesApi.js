import { api } from './client';

export const ejecucionesApi = {
  list: (cicloId, filtros) => {
    const params = new URLSearchParams(Object.entries(filtros || {}).filter(([, v]) => v));
    const qs = params.toString();
    return api.getAll(`/ciclos/${cicloId}/ejecuciones${qs ? `?${qs}` : ''}`);
  },
  getById: (id) => api.get(`/ejecuciones/${id}`),
  listByCaso: (casoId) => api.getAll(`/casos/${casoId}/ejecuciones`),
  tomar: (id) => api.patch(`/ejecuciones/${id}/tomar`),
  registrarResultado: (id, data) => api.patch(`/ejecuciones/${id}/resultado`, data),
  reintentar: (id) => api.patch(`/ejecuciones/${id}/reintentar`),
};
