import { useState } from 'react';
import Modal from '../../components/Modal';
import TipoPruebaBadge from '../../components/TipoPruebaBadge';
import { defectosApi } from '../../api/defectosApi';
import { useUsuario } from '../../context/UsuarioContext';

export default function DefectoFormModal({ ejecucionId, tipoPrueba, onClose, onCreado }) {
  const { usuario } = useUsuario();
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [severidad, setSeveridad] = useState('media');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const defecto = await defectosApi.createFromEjecucion(ejecucionId, {
        titulo, descripcion, severidad, reportadoPorId: usuario.id,
      });
      onCreado(defecto);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal title="Reportar defecto" onClose={onClose}>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="field">
        <label>Tipo de prueba</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TipoPruebaBadge tipoPrueba={tipoPrueba} />
          <span style={{ fontSize: 11.5, color: 'var(--text-2)' }}>heredado de la ejecución</span>
        </div>
      </div>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="d-titulo">Título</label>
          <input id="d-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="d-desc">Descripción</label>
          <textarea id="d-desc" rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="d-sev">Severidad</label>
          <select id="d-sev" value={severidad} onChange={(e) => setSeveridad(e.target.value)}>
            <option value="critica">Crítica</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-2)' }}>
          <button type="button" className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={guardando}>
            {guardando ? 'Reportando…' : 'Reportar defecto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
