import { api } from './client';

export const etiquetasApi = {
  list: (proyectoId) => api.get(`/proyectos/${proyectoId}/etiquetas`),
  create: (proyectoId, data) => api.post(`/proyectos/${proyectoId}/etiquetas`, data),
  remove: (id) => api.delete(`/etiquetas/${id}`),
};
