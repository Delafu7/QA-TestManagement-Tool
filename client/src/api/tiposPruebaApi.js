import { api } from './client';

export const tiposPruebaApi = {
  list: (proyectoId) => api.get(`/proyectos/${proyectoId}/tipos-prueba`),
  create: (proyectoId, data) => api.post(`/proyectos/${proyectoId}/tipos-prueba`, data),
  update: (id, data) => api.patch(`/tipos-prueba/${id}`, data),
  archivar: (id) => api.patch(`/tipos-prueba/${id}/archivar`),
};
