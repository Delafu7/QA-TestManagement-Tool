import { api } from './client';

export const proyectosApi = {
  list: (estado) => api.get(`/proyectos${estado ? `?estado=${estado}` : ''}`),
  getById: (id) => api.get(`/proyectos/${id}`),
  create: (data) => api.post('/proyectos', data),
  update: (id, data) => api.patch(`/proyectos/${id}`, data),
  archivar: (id) => api.patch(`/proyectos/${id}/archivar`),
};
