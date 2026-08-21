import { useState } from 'react';
import Modal from '../../components/Modal';
import { ciclosApi } from '../../api/ciclosApi';
import { useUsuario } from '../../context/UsuarioContext';

export default function CicloFormModal({ proyectoId, onClose, onCreado }) {
  const { usuario } = useUsuario();
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFinPrevista, setFechaFinPrevista] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const ciclo = await ciclosApi.create(proyectoId, {
        nombre, descripcion, fechaInicio, fechaFinPrevista, responsableId: usuario.id,
      });
      onCreado(ciclo);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal title="Nueva fase" onClose={onClose}>
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="ci-nombre">Nombre</label>
          <input id="ci-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus placeholder="p. ej. Sprint 14 — Regresión" />
        </div>
        <div className="field">
          <label htmlFor="ci-desc">Descripción</label>
          <textarea id="ci-desc" rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label htmlFor="ci-inicio">Fecha inicio</label>
            <input id="ci-inicio" type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="ci-fin">Fin previsto</label>
            <input id="ci-fin" type="date" value={fechaFinPrevista} onChange={(e) => setFechaFinPrevista(e.target.value)} required />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-2)' }}>
          <button type="button" className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={guardando}>
            {guardando ? 'Creando…' : 'Crear fase'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
