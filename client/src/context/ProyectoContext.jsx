import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { proyectosApi } from '../api/proyectosApi';
import { useUsuario } from './UsuarioContext';

const STORAGE_KEY = 'qa-tool:proyectoId';
const ProyectoContext = createContext(null);

export function ProyectoProvider({ children }) {
  const { usuario } = useUsuario();
  const [proyectos, setProyectos] = useState([]);
  const [proyectoId, setProyectoId] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await proyectosApi.list('activo');
      setProyectos(data);
      const storedId = localStorage.getItem(STORAGE_KEY);
      const sigueExistiendo = data.some((p) => p.id === storedId);
      const siguiente = sigueExistiendo ? storedId : data[0]?.id ?? null;
      setProyectoId(siguiente);
      if (siguiente) localStorage.setItem(STORAGE_KEY, siguiente);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (usuario) cargar();
  }, [usuario, cargar]);

  const seleccionarProyecto = useCallback((id) => {
    setProyectoId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const proyectoActual = proyectos.find((p) => p.id === proyectoId) || null;

  return (
    <ProyectoContext.Provider
      value={{ proyectos, proyectoId, proyectoActual, cargando, seleccionarProyecto, recargar: cargar }}
    >
      {children}
    </ProyectoContext.Provider>
  );
}

export function useProyecto() {
  const ctx = useContext(ProyectoContext);
  if (!ctx) throw new Error('useProyecto debe usarse dentro de ProyectoProvider');
  return ctx;
}
