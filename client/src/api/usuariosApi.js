import { api } from './client';

export const usuariosApi = {
  list: (rol) => api.getAll(`/usuarios${rol ? `?rol=${rol}` : ''}`),
  getById: (id) => api.get(`/usuarios/${id}`),
  create: (data) => api.post('/usuarios', data),
  update: (id, data) => api.patch(`/usuarios/${id}`, data),
};
