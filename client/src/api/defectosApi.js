import { api } from './client';

const toQuery = (filtros) => {
  const params = new URLSearchParams(Object.entries(filtros || {}).filter(([, v]) => v));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
};

export const defectosApi = {
  // Devuelve solo la primera página: para vistas previa (ej. "últimos defectos" del
  // dashboard). Si en el futuro hay una pantalla de listado completo de defectos,
  // debería usar api.getAll como el resto de recursos.
  list: (proyectoId, filtros) => api.get(`/proyectos/${proyectoId}/defectos${toQuery(filtros)}`),
  // Recuento exacto sin traer las filas (ej. KPI "Defectos abiertos" del dashboard).
  count: (proyectoId, filtros) => api.count(`/proyectos/${proyectoId}/defectos${toQuery(filtros)}`),
  getById: (id) => api.get(`/defectos/${id}`),
  createFromEjecucion: (ejecucionId, data) => api.post(`/ejecuciones/${ejecucionId}/defectos`, data),
  asignar: (id) => api.patch(`/defectos/${id}/asignar`),
  resolver: (id) => api.patch(`/defectos/${id}/resolver`),
  verificar: (id) => api.patch(`/defectos/${id}/verificar`),
  reabrir: (id) => api.patch(`/defectos/${id}/reabrir`),
};
