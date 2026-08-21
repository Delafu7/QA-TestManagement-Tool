import { api } from './client';

export const defectosApi = {
  list: (proyectoId, filtros) => {
    const params = new URLSearchParams(Object.entries(filtros || {}).filter(([, v]) => v));
    const qs = params.toString();
    return api.get(`/proyectos/${proyectoId}/defectos${qs ? `?${qs}` : ''}`);
  },
  getById: (id) => api.get(`/defectos/${id}`),
  createFromEjecucion: (ejecucionId, data) => api.post(`/ejecuciones/${ejecucionId}/defectos`, data),
  asignar: (id) => api.patch(`/defectos/${id}/asignar`),
  resolver: (id) => api.patch(`/defectos/${id}/resolver`),
  verificar: (id) => api.patch(`/defectos/${id}/verificar`),
  reabrir: (id) => api.patch(`/defectos/${id}/reabrir`),
};
