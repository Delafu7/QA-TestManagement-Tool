import { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import EstadoBadge from '../../components/EstadoBadge';
import TagList from '../../components/TagList';
import TipoPruebaBadge from '../../components/TipoPruebaBadge';
import CasoFormModal from './CasoFormModal';
import { casosApi } from '../../api/casosApi';
import { ejecucionesApi } from '../../api/ejecucionesApi';
import { tiposPruebaApi } from '../../api/tiposPruebaApi';
import { useUsuario } from '../../context/UsuarioContext';

export default function CasoDetalleModal({ casoId, proyectoId, suites, onClose, onCambiado }) {
  const { usuario } = useUsuario();
  const [caso, setCaso] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [tiposPrueba, setTiposPrueba] = useState(null);
  const [error, setError] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    casosApi.getById(casoId).then(setCaso).catch((e) => setError(e.message));
    ejecucionesApi.listByCaso(casoId).then(({ data }) => setHistorial(data)).catch(() => setHistorial([]));
    if (proyectoId) tiposPruebaApi.list(proyectoId).then(setTiposPrueba).catch(() => setTiposPrueba([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [casoId]);

  const suiteActual = suites?.find((s) => s.id === caso?.suiteId);

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
            <TipoPruebaBadge tipoPrueba={tiposPrueba?.find((t) => t.id === caso.tipoPruebaId)} />
            {usuario.rol === 'qa' && (
              <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setEditando(true)}>Editar</button>
            )}
          </div>

          {(suiteActual || (caso.etiquetaIds?.length > 0 && proyectoId)) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--text-2)' }}>
              {suiteActual && <span>Suite: <strong style={{ color: 'var(--text)' }}>{suiteActual.nombre}</strong></span>}
              {proyectoId && <TagList proyectoId={proyectoId} etiquetaIds={caso.etiquetaIds} />}
            </div>
          )}

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

          <div style={{ fontSize: 13, fontWeight: 600, margin: '16px 0 8px' }}>
            Historial de ejecuciones {historial ? `(${historial.length})` : ''}
          </div>
          {historial === null && <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>Cargando&hellip;</div>}
          {historial?.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>Este caso todavía no se ha ejecutado.</div>}
          {historial?.map((h) => (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: 12.5, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 500 }}>{h.cicloNombre}</span>
              <EstadoBadge estado={h.estado} size="sm" />
              <span style={{ color: 'var(--text-2)' }}>{h.ejecutorNombre || 'sin asignar'}</span>
              {h.fechaEjecucion && <span style={{ color: 'var(--text-2)' }}>{new Date(h.fechaEjecucion).toLocaleDateString()}</span>}
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

      {editando && caso && (
        <CasoFormModal
          proyectoId={proyectoId}
          suites={suites || []}
          caso={caso}
          onClose={() => setEditando(false)}
          onGuardado={(actualizado) => {
            setCaso(actualizado);
            onCambiado?.(actualizado);
            setEditando(false);
          }}
        />
      )}
    </Modal>
  );
}
