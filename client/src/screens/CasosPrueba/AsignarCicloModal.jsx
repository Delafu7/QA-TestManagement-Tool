import { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import { ciclosApi } from '../../api/ciclosApi';

export default function AsignarCicloModal({ proyectoId, casoIds, onClose, onAsignado }) {
  const [ciclos, setCiclos] = useState(null);
  const [cicloId, setCicloId] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    ciclosApi.list(proyectoId).then((r) => {
      const abiertos = r.data.filter((c) => c.estado === 'planificada' || c.estado === 'en_progreso');
      setCiclos(abiertos);
      setCicloId(abiertos[0]?.id || '');
    });
  }, [proyectoId]);

  async function submit(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await ciclosApi.asignarCasos(cicloId, casoIds);
      onAsignado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal title="Añadir a ciclo" onClose={onClose}>
      {error && <div className="alert alert-error">{error}</div>}
      {ciclos?.length === 0 && (
        <p style={{ fontSize: 13.5, color: 'var(--text-2)' }}>No hay ciclos planificados o en progreso. Crea uno primero desde "Fases".</p>
      )}
      {ciclos?.length > 0 && (
        <form onSubmit={submit}>
          <p style={{ fontSize: 13, color: 'var(--text-2)' }}>{casoIds.length} caso(s) seleccionado(s)</p>
          <div className="field">
            <label htmlFor="ciclo">Ciclo</label>
            <select id="ciclo" value={cicloId} onChange={(e) => setCicloId(e.target.value)} required>
              {ciclos.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-2)' }}>
            <button type="button" className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={guardando}>
              {guardando ? 'Añadiendo…' : 'Añadir'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
