import { useState } from 'react';
import Modal from '../../components/Modal';
import { exportApi } from '../../api/exportApi';

export default function NotionExportModal({ cicloId, onClose }) {
  const [notionDatabaseId, setNotionDatabaseId] = useState('');
  const [notionToken, setNotionToken] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    setResultado(null);
    try {
      const r = await exportApi.sendToNotion(cicloId, { notionDatabaseId, notionToken });
      setResultado(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal title="Enviar a Notion" onClose={onClose}>
      {error && <div className="alert alert-error">{error}</div>}
      {resultado && (
        <div className="alert alert-success">
          {resultado.enviados} ejecución(es) enviada(s){resultado.fallidos > 0 ? `, ${resultado.fallidos} fallida(s)` : ''}.
        </div>
      )}
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="notion-db">ID de la base de datos de Notion</label>
          <input id="notion-db" value={notionDatabaseId} onChange={(e) => setNotionDatabaseId(e.target.value)} required autoFocus placeholder="a1b2c3d4e5f6…" />
        </div>
        <div className="field">
          <label htmlFor="notion-token">Token de integración</label>
          <input id="notion-token" type="password" value={notionToken} onChange={(e) => setNotionToken(e.target.value)} required placeholder="secret_…" />
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: -6 }}>
          El token no se guarda; se usa solo para este envío.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-2)' }}>
          <button type="button" className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cerrar</button>
          <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
