import { api } from './client';

const toQuery = (params) => {
  const entries = Object.entries(params || {}).filter(([, v]) => v);
  if (!entries.length) return '';
  return `?${new URLSearchParams(entries).toString()}`;
};

export const proyectosApi = {
  list: (estado) => api.getAll(`/proyectos${estado ? `?estado=${estado}` : ''}`),
  getById: (id) => api.get(`/proyectos/${id}`),
  create: (data) => api.post('/proyectos', data),
  update: (id, data) => api.patch(`/proyectos/${id}`, data),
  archivar: (id) => api.patch(`/proyectos/${id}/archivar`),
  // Widget "casos modificados" del dashboard: recuento agregado en servidor sobre
  // TODO el histórico de versiones del periodo, no una página ya recortada.
  casosModificados: (id, { desde, hasta } = {}) => api.get(`/proyectos/${id}/casos-modificados${toQuery({ desde, hasta, pageSize: 5 })}`),
  resumenPorTipoPrueba: (id) => api.get(`/proyectos/${id}/resumen-tipos-prueba`),
};
