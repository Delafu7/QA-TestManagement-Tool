import { api } from './client';

export const suitesApi = {
  tree: (proyectoId) => api.get(`/proyectos/${proyectoId}/suites`),
  getById: (id) => api.get(`/suites/${id}`),
  create: (proyectoId, data) => api.post(`/proyectos/${proyectoId}/suites`, data),
  update: (id, data) => api.patch(`/suites/${id}`, data),
  remove: (id) => api.delete(`/suites/${id}`),
};
