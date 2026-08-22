import { useState } from 'react';
import Modal from './Modal';
import { proyectosApi } from '../api/proyectosApi';

export default function AjustesProyectoModal({ proyecto, onClose, onGuardado, onArchivado }) {
  const [nombre, setNombre] = useState(proyecto.nombre);
  const [descripcion, setDescripcion] = useState(proyecto.descripcion || '');
  const [guardando, setGuardando] = useState(false);
  const [archivando, setArchivando] = useState(false);
  const [confirmandoArchivar, setConfirmandoArchivar] = useState(false);
  const [error, setError] = useState(null);

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const actualizado = await proyectosApi.update(proyecto.id, { nombre, descripcion });
      onGuardado(actualizado);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function archivar() {
    setArchivando(true);
    setError(null);
    try {
      await proyectosApi.archivar(proyecto.id);
      onArchivado();
    } catch (err) {
      setError(err.message);
      setArchivando(false);
      setConfirmandoArchivar(false);
    }
  }

  return (
    <Modal title="Ajustes del proyecto" onClose={onClose}>
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={guardar}>
        <div className="field">
          <label htmlFor="ap-nombre">Nombre</label>
          <input id="ap-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="ap-desc">Descripción</label>
          <textarea id="ap-desc" rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-2)' }}>
          <button type="button" className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>

      <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Archivar proyecto</div>
        <p style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 0, marginBottom: 12 }}>
          El proyecto dejará de aparecer en el selector. Las suites, casos y ciclos existentes no se borran.
        </p>
        {!confirmandoArchivar && (
          <button type="button" className="btn btn-ghost" onClick={() => setConfirmandoArchivar(true)}>
            Archivar proyecto
          </button>
        )}
        {confirmandoArchivar && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>¿Seguro?</span>
            <button type="button" className="btn btn-ghost" style={{ color: 'var(--fail)' }} disabled={archivando} onClick={archivar}>
              {archivando ? 'Archivando…' : 'Sí, archivar'}
            </button>
            <button type="button" className="btn btn-ghost" disabled={archivando} onClick={() => setConfirmandoArchivar(false)}>
              Cancelar
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
