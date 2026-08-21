import { useState } from 'react';
import Modal from './Modal';
import { proyectosApi } from '../api/proyectosApi';
import { useUsuario } from '../context/UsuarioContext';

export default function CrearProyectoModal({ onClose, onCreado }) {
  const { usuario } = useUsuario();
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const proyecto = await proyectosApi.create({ nombre, descripcion, propietarioId: usuario.id });
      onCreado(proyecto);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal title="Nuevo proyecto" onClose={onClose}>
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="p-nombre">Nombre</label>
          <input id="p-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="p-desc">Descripción</label>
          <textarea id="p-desc" rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-2)' }}>
          <button type="button" className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={guardando}>
            {guardando ? 'Creando…' : 'Crear proyecto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
