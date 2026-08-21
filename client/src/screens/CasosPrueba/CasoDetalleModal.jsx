import { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import EstadoBadge from '../../components/EstadoBadge';
import { casosApi } from '../../api/casosApi';
import { useUsuario } from '../../context/UsuarioContext';

export default function CasoDetalleModal({ casoId, onClose, onCambiado }) {
  const { usuario } = useUsuario();
  const [caso, setCaso] = useState(null);
  const [error, setError] = useState(null);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    casosApi.getById(casoId).then(setCaso).catch((e) => setError(e.message));
  }, [casoId]);

  async function transicionar(accion) {
    setProcesando(true);
    setError(null);
    try {
      const actualizado = await accion(casoId);
      setCaso(actualizado);
      onCambiado?.(actualizado);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  }

  return (
    <Modal title={caso ? caso.titulo : 'Cargando…'} onClose={onClose} width={600}>
      {error && <div className="alert alert-error">{error}</div>}
      {!caso && !error && <div className="center-state">Cargando&hellip;</div>}
      {caso && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <EstadoBadge estado={caso.estado} />
            <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>Prioridad: <strong style={{ color: 'var(--text)', textTransform: 'capitalize' }}>{caso.prioridad}</strong></span>
            <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>Tipo: <strong style={{ color: 'var(--text)', textTransform: 'capitalize' }}>{caso.tipo}</strong></span>
          </div>

          {caso.descripcion && (
            <p style={{ fontSize: 13.5, color: 'var(--text)', marginTop: 0 }}>{caso.descripcion}</p>
          )}
          {caso.precondiciones && (
            <p style={{ fontSize: 12.5, color: 'var(--text-2)' }}><strong>Precondiciones:</strong> {caso.precondiciones}</p>
          )}

          <div style={{ fontSize: 13, fontWeight: 600, margin: '16px 0 8px' }}>Pasos</div>
          {caso.pasos.map((p, i) => (
            <div key={p.id} style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{i + 1}. {p.accion}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>&rarr; {p.resultadoEsperado}</div>
            </div>
          ))}

          {usuario.rol === 'qa' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              {caso.estado === 'borrador' && (
                <button className="btn btn-primary" disabled={procesando} onClick={() => transicionar(casosApi.publicar)}>Publicar</button>
              )}
              {caso.estado === 'activo' && (
                <button className="btn btn-ghost" disabled={procesando} onClick={() => transicionar(casosApi.deprecar)}>Deprecar</button>
              )}
              {caso.estado === 'obsoleto' && (
                <button className="btn btn-ghost" disabled={procesando} onClick={() => transicionar(casosApi.reactivar)}>Reactivar</button>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
