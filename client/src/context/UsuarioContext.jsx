import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { usuariosApi } from '../api/usuariosApi';
import { setUsuarioId as setApiUsuarioId } from '../api/client';

const STORAGE_KEY = 'qa-tool:usuarioId';
const UsuarioContext = createContext(null);

export function UsuarioProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const storedId = localStorage.getItem(STORAGE_KEY);
    if (!storedId) {
      setCargando(false);
      return;
    }
    setApiUsuarioId(storedId);
    usuariosApi
      .getById(storedId)
      .then((u) => setUsuario(u))
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY);
        setApiUsuarioId(null);
      })
      .finally(() => setCargando(false));
  }, []);

  const seleccionarUsuario = useCallback((u) => {
    localStorage.setItem(STORAGE_KEY, u.id);
    setApiUsuarioId(u.id);
    setUsuario(u);
  }, []);

  const cerrarSesion = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setApiUsuarioId(null);
    setUsuario(null);
  }, []);

  return (
    <UsuarioContext.Provider value={{ usuario, cargando, seleccionarUsuario, cerrarSesion }}>
      {children}
    </UsuarioContext.Provider>
  );
}

export function useUsuario() {
  const ctx = useContext(UsuarioContext);
  if (!ctx) throw new Error('useUsuario debe usarse dentro de UsuarioProvider');
  return ctx;
}
