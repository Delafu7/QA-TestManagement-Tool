import { useState } from 'react';
import Modal from './Modal';
import { suitesApi } from '../api/suitesApi';

export default function CrearSuiteModal({ proyectoId, suites, onClose, onCreada }) {
  const [nombre, setNombre] = useState('');
  const [suitePadreId, setSuitePadreId] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const suite = await suitesApi.create(proyectoId, { nombre, suitePadreId: suitePadreId || null });
      onCreada(suite);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal title="Nueva suite" onClose={onClose}>
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="s-nombre">Nombre</label>
          <input id="s-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus placeholder="p. ej. Auth &gt; Login" />
        </div>
        {suites.length > 0 && (
          <div className="field">
            <label htmlFor="s-padre">Suite padre (opcional)</label>
            <select id="s-padre" value={suitePadreId} onChange={(e) => setSuitePadreId(e.target.value)}>
              <option value="">Ninguna (raíz)</option>
              {suites.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-2)' }}>
          <button type="button" className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={guardando}>
            {guardando ? 'Creando…' : 'Crear suite'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
