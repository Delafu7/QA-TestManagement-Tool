import { api } from './client';

export const ciclosApi = {
  list: (proyectoId, estado) => api.getAll(`/proyectos/${proyectoId}/ciclos${estado ? `?estado=${estado}` : ''}`),
  getById: (id) => api.get(`/ciclos/${id}`),
  create: (proyectoId, data) => api.post(`/proyectos/${proyectoId}/ciclos`, data),
  asignarCasos: (id, casoIds) => api.post(`/ciclos/${id}/casos`, { casoIds }),
  iniciar: (id) => api.patch(`/ciclos/${id}/iniciar`),
  bloquear: (id, comentario) => api.patch(`/ciclos/${id}/bloquear`, { comentario }),
  desbloquear: (id) => api.patch(`/ciclos/${id}/desbloquear`),
  completar: (id) => api.patch(`/ciclos/${id}/completar`),
};
