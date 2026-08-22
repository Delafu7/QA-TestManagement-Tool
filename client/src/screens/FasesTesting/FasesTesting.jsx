import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProyecto } from '../../context/ProyectoContext';
import { useUsuario } from '../../context/UsuarioContext';
import { useFetch } from '../../hooks/useFetch';
import { ciclosApi } from '../../api/ciclosApi';
import EstadoBadge from '../../components/EstadoBadge';
import Modal from '../../components/Modal';
import CrearProyectoModal from '../../components/CrearProyectoModal';
import { IconPlus } from '../../components/icons';
import CicloFormModal from './CicloFormModal';
import { pct } from '../../utils/metrics';

function CicloCard({ ciclo, isQa, onAccion, onIrAEjecutar }) {
  const total = ciclo.totalCasos || 1;
  return (
    <div className="card" style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{ciclo.nombre}</span>
          <EstadoBadge estado={ciclo.estado} />
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
          {ciclo.fechaFinReal ? `completado ${ciclo.fechaFinReal}` : `${ciclo.fechaInicio} – ${ciclo.fechaFinPrevista}`}
        </div>
      </div>

      <div className="progress-bar progress-bar--thin" style={{ marginBottom: 10 }}>
        <div style={{ width: `${pct(ciclo.passed, total)}%`, background: 'var(--pass)' }} />
        <div style={{ width: `${pct(ciclo.failed, total)}%`, background: 'var(--fail)' }} />
        <div style={{ width: `${pct(ciclo.blocked, total)}%`, background: 'var(--block)' }} />
        <div style={{ width: `${pct(ciclo.pendiente, total)}%`, background: 'var(--border)' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>passed <strong style={{ color: 'var(--text)' }}>{ciclo.passed}</strong></span>
        <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>failed <strong style={{ color: 'var(--text)' }}>{ciclo.failed}</strong></span>
        <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>blocked <strong style={{ color: 'var(--text)' }}>{ciclo.blocked}</strong></span>
        <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>pendiente <strong style={{ color: 'var(--text)' }}>{ciclo.pendiente}</strong></span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          {isQa && ciclo.estado === 'planificada' && (
            <button className="btn btn-primary btn-sm" onClick={() => onAccion('iniciar', ciclo)}>Iniciar</button>
          )}
          {isQa && ciclo.estado === 'en_progreso' && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => onAccion('bloquear', ciclo)}>Bloquear</button>
              <button className="btn btn-ghost btn-sm" onClick={() => onAccion('completar', ciclo)}>Completar</button>
              <button className="btn btn-primary btn-sm" onClick={() => onIrAEjecutar(ciclo)}>Ir a ejecutar</button>
            </>
          )}
          {isQa && ciclo.estado === 'bloqueada' && (
            <button className="btn btn-primary btn-sm" onClick={() => onAccion('desbloquear', ciclo)}>Desbloquear</button>
          )}
          {(ciclo.estado === 'completada' || !isQa) && (
            <button className="btn btn-primary btn-sm" onClick={() => onIrAEjecutar(ciclo, true)}>Ver resultados</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FasesTesting() {
  const { proyectoId, proyectoActual, cargando: cargandoProyecto, recargar: recargarProyectos } = useProyecto();
  const { usuario } = useUsuario();
  const isQa = usuario.rol === 'qa';
  const navigate = useNavigate();

  const { data: ciclos, loading, error, refetch } = useFetch(
    async () => {
      if (!proyectoId) return { data: [] };
      const { data } = await ciclosApi.list(proyectoId);
      const detallados = await Promise.all(data.map((c) => ciclosApi.getById(c.id)));
      return { data: detallados };
    },
    [proyectoId]
  );

  const [modal, setModal] = useState(null); // 'crearProyecto' | 'crearCiclo' | { tipo:'bloquear', ciclo }
  const [comentario, setComentario] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [accionError, setAccionError] = useState(null);

  async function ejecutarAccion(tipo, ciclo, extra) {
    setProcesando(true);
    setAccionError(null);
    try {
      if (tipo === 'iniciar') await ciclosApi.iniciar(ciclo.id);
      if (tipo === 'bloquear') await ciclosApi.bloquear(ciclo.id, extra);
      if (tipo === 'desbloquear') await ciclosApi.desbloquear(ciclo.id);
      if (tipo === 'completar') await ciclosApi.completar(ciclo.id);
      setModal(null);
      setComentario('');
      refetch();
    } catch (err) {
      setAccionError(err.message);
    } finally {
      setProcesando(false);
    }
  }

  function onAccion(tipo, ciclo) {
    if (tipo === 'bloquear') {
      setModal({ tipo: 'bloquear', ciclo });
      return;
    }
    ejecutarAccion(tipo, ciclo);
  }

  function onIrAEjecutar(ciclo, verResultados) {
    navigate(verResultados ? `/resultados/${ciclo.id}` : `/ejecucion/${ciclo.id}`);
  }

  if (cargandoProyecto) return <div className="center-state">Cargando&hellip;</div>;

  if (!proyectoActual) {
    return (
      <div className="center-state">
        <p>Todavía no hay ningún proyecto.</p>
        <button className="btn btn-primary" onClick={() => setModal('crearProyecto')}>Crear el primer proyecto</button>
        {modal === 'crearProyecto' && (
          <CrearProyectoModal onClose={() => setModal(null)} onCreado={async () => { await recargarProyectos(); setModal(null); }} />
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Fases de testing</h1>
          <div className="page-subtitle">{proyectoActual.nombre} &middot; {ciclos?.data.length ?? 0} ciclos</div>
        </div>
        {isQa && (
          <button className="btn btn-primary" onClick={() => setModal('crearCiclo')}>
            <IconPlus size={15} color="white" />
            Nueva fase
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error.message}</div>}
      {loading && <div className="center-state">Cargando ciclos&hellip;</div>}

      {ciclos?.data.length === 0 && (
        <div className="center-state">
          <p>Todavía no hay ninguna fase en este proyecto.</p>
          {isQa && <button className="btn btn-primary" onClick={() => setModal('crearCiclo')}>Crear la primera fase</button>}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {ciclos?.data.map((c) => (
          <CicloCard key={c.id} ciclo={c} isQa={isQa} onAccion={onAccion} onIrAEjecutar={onIrAEjecutar} />
        ))}
      </div>

      {modal === 'crearCiclo' && (
        <CicloFormModal proyectoId={proyectoId} onClose={() => setModal(null)} onCreado={() => { setModal(null); refetch(); }} />
      )}

      {modal?.tipo === 'bloquear' && (
        <Modal title={`Bloquear "${modal.ciclo.nombre}"`} onClose={() => setModal(null)}>
          {accionError && <div className="alert alert-error">{accionError}</div>}
          <div className="field">
            <label htmlFor="comentario-bloqueo">Motivo del bloqueo</label>
            <textarea id="comentario-bloqueo" rows={3} value={comentario} onChange={(e) => setComentario(e.target.value)} required autoFocus />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setModal(null)}>Cancelar</button>
            <button
              className="btn btn-primary"
              style={{ flex: 1, justifyContent: 'center' }}
              disabled={procesando || !comentario}
              onClick={() => ejecutarAccion('bloquear', modal.ciclo, comentario)}
            >
              {procesando ? 'Bloqueando…' : 'Bloquear ciclo'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
