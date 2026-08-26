import { api } from './client';

const withQuery = (path, params) => {
  const qs = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v)).toString();
  return qs ? `${path}?${qs}` : path;
};

export const runnerApi = {
  status: () => api.get('/runner/status'),
  comandos: () => api.get('/runner/comandos'),
  directorio: (ruta) => api.get(withQuery('/runner/directorio', { ruta })),
  cd: (ruta, segmento) => api.post('/runner/directorio/cd', { ruta, segmento }),
  iniciar: (data) => api.post('/runner/ejecuciones', data),
  list: (filtros) => api.getAll(withQuery('/runner/ejecuciones', filtros)),
  getById: (id) => api.get(`/runner/ejecuciones/${id}`),
  abortar: (id) => api.patch(`/runner/ejecuciones/${id}/abortar`),
  stream: (id, onEvent) => api.stream(`/runner/ejecuciones/${id}/stream`, onEvent),
};
