import { useEffect, useState } from 'react';
import Modal from './Modal';
import EstadoBadge from './EstadoBadge';
import TipoPruebaBadge from './TipoPruebaBadge';
import { defectosApi } from '../api/defectosApi';
import { tiposPruebaApi } from '../api/tiposPruebaApi';
import { useUsuario } from '../context/UsuarioContext';

const SEV_COLOR = { critica: 'var(--fail)', alta: 'var(--fail)', media: 'var(--block)', baja: 'var(--skip)' };
const SEV_BG = { critica: 'var(--fail-bg)', alta: 'var(--fail-bg)', media: 'var(--block-bg)', baja: 'var(--skip-bg)' };

export default function DefectoDetalleModal({ defectoId, onClose, onCambiado }) {
  const { usuario } = useUsuario();
  const [defecto, setDefecto] = useState(null);
  const [tiposPrueba, setTiposPrueba] = useState(null);
  const [error, setError] = useState(null);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    defectosApi.getById(defectoId).then((d) => {
      setDefecto(d);
      tiposPruebaApi.list(d.proyectoId).then(setTiposPrueba).catch(() => setTiposPrueba([]));
    }).catch((e) => setError(e.message));
  }, [defectoId]);

  async function transicionar(accion) {
    setProcesando(true);
    setError(null);
    try {
      const actualizado = await accion(defectoId);
      setDefecto(actualizado);
      onCambiado?.(actualizado);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  }

  return (
    <Modal title={defecto ? defecto.titulo : 'Cargando…'} onClose={onClose} width={520}>
      {error && <div className="alert alert-error">{error}</div>}
      {!defecto && !error && <div className="center-state">Cargando&hellip;</div>}
      {defecto && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <EstadoBadge estado={defecto.estado} />
            <span
              className="badge"
              style={{ background: SEV_BG[defecto.severidad], color: SEV_COLOR[defecto.severidad], padding: '4px 10px', fontSize: 11.5, textTransform: 'capitalize' }}
            >
              {defecto.severidad}
            </span>
            <TipoPruebaBadge tipoPrueba={tiposPrueba?.find((t) => t.id === defecto.tipoPruebaId)} />
          </div>

          {defecto.descripcion && (
            <p style={{ fontSize: 13.5, color: 'var(--text)', marginTop: 0 }}>{defecto.descripcion}</p>
          )}

          {usuario.rol === 'qa' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
              {['abierto', 'reabierto'].includes(defecto.estado) && (
                <button className="btn btn-primary" disabled={procesando} onClick={() => transicionar(defectosApi.asignar)}>Asignar a mí</button>
              )}
              {defecto.estado === 'en_progreso' && (
                <button className="btn btn-primary" disabled={procesando} onClick={() => transicionar(defectosApi.resolver)}>Marcar resuelto</button>
              )}
              {defecto.estado === 'resuelto' && (
                <>
                  <button className="btn btn-primary" disabled={procesando} onClick={() => transicionar(defectosApi.verificar)}>Verificar y cerrar</button>
                  <button className="btn btn-ghost" disabled={procesando} onClick={() => transicionar(defectosApi.reabrir)}>Reabrir</button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
