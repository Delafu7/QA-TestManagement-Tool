import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ciclosApi } from '../../api/ciclosApi';
import { ejecucionesApi } from '../../api/ejecucionesApi';
import { casosApi } from '../../api/casosApi';
import { tiposPruebaApi } from '../../api/tiposPruebaApi';
import { IconArrowLeft, IconCheck, IconCross, IconBlock, IconSkip, IconClock, IconWarning } from '../../components/icons';
import DefectoFormModal from './DefectoFormModal';
import TipoPruebaBadge from '../../components/TipoPruebaBadge';

const ESTADO_ICON = { passed: IconCheck, failed: IconCross, blocked: IconBlock, skipped: IconSkip };
const ESTADO_COLOR = {
  passed: 'var(--pass)', failed: 'var(--fail)', blocked: 'var(--block)', skipped: 'var(--skip)',
};

const PASO_OPCIONES = [
  { valor: 'pass', label: 'Pass', color: 'var(--pass)', Icon: IconCheck },
  { valor: 'fail', label: 'Fail', color: 'var(--fail)', Icon: IconCross },
  { valor: 'skip', label: 'Skip', color: 'var(--skip)', Icon: IconSkip },
];

const RESULTADO_OPCIONES = [
  { valor: 'passed', label: 'Passed', color: 'var(--pass)', Icon: IconCheck },
  { valor: 'failed', label: 'Failed', color: 'var(--fail)', Icon: IconCross },
  { valor: 'blocked', label: 'Blocked', color: 'var(--block)', Icon: IconBlock },
  { valor: 'skipped', label: 'Skipped', color: 'var(--skip)', Icon: IconSkip },
];

function ordenCola(a, b) {
  const pesoEstado = (e) => (e.estado === 'en_progreso' ? 0 : e.estado === 'pendiente' ? 1 : 2);
  return pesoEstado(a) - pesoEstado(b);
}

export default function EjecucionCiclo() {
  const { cicloId } = useParams();

  const [ciclo, setCiclo] = useState(null);
  const [cola, setCola] = useState(null);
  const [tiposPrueba, setTiposPrueba] = useState(null);
  const [error, setError] = useState(null);

  const [seleccionId, setSeleccionId] = useState(null);
  const [ejecucionActual, setEjecucionActual] = useState(null);
  const [casoActual, setCasoActual] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const [resultadosPaso, setResultadosPaso] = useState({});
  const [resultadoGeneral, setResultadoGeneral] = useState(null);
  const [comentario, setComentario] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [modalDefecto, setModalDefecto] = useState(false);
  const [reintentando, setReintentando] = useState(false);

  const cargarCola = useCallback(async () => {
    const [cicloRes, ejecucionesRes] = await Promise.all([
      ciclosApi.getById(cicloId),
      ejecucionesApi.list(cicloId),
    ]);
    setCiclo(cicloRes);
    if (cicloRes.proyectoId) {
      tiposPruebaApi.list(cicloRes.proyectoId).then(setTiposPrueba).catch(() => setTiposPrueba([]));
    }

    const casoIds = [...new Set(ejecucionesRes.data.map((e) => e.casoId))];
    const casosMap = new Map();
    await Promise.all(casoIds.map(async (id) => {
      const caso = await casosApi.getById(id);
      casosMap.set(id, caso);
    }));

    const enriquecidas = ejecucionesRes.data
      .map((e) => ({ ...e, caso: casosMap.get(e.casoId) }))
      .sort(ordenCola);
    setCola(enriquecidas);
    return enriquecidas;
  }, [cicloId]);

  useEffect(() => {
    setError(null);
    cargarCola()
      .then((enriquecidas) => {
        const primera = enriquecidas.find((e) => e.estado === 'pendiente' || e.estado === 'en_progreso');
        setSeleccionId(primera?.id || enriquecidas[0]?.id || null);
      })
      .catch((e) => setError(e.message));
  }, [cargarCola]);

  useEffect(() => {
    if (!seleccionId || !cola) return;
    const item = cola.find((e) => e.id === seleccionId);
    if (!item) return;

    setCargandoDetalle(true);
    setResultadosPaso({});
    setResultadoGeneral(null);
    setComentario('');

    (async () => {
      try {
        let ejecucion = item;
        if (item.estado === 'pendiente') {
          ejecucion = await ejecucionesApi.tomar(item.id);
        } else if (item.estado !== 'en_progreso') {
          ejecucion = await ejecucionesApi.getById(item.id);
          const prellenado = {};
          ejecucion.resultadosPaso.forEach((r) => { prellenado[r.pasoId] = r.estado; });
          setResultadosPaso(prellenado);
          setResultadoGeneral(ejecucion.estado);
          setComentario(ejecucion.comentario || '');
        }
        setEjecucionActual(ejecucion);
        setCasoActual(item.caso);
      } catch (err) {
        setError(err.message);
      } finally {
        setCargandoDetalle(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionId]);

  const totalCasos = cola?.length ?? 0;
  const ejecutados = cola?.filter((e) => e.estado !== 'pendiente' && e.estado !== 'en_progreso').length ?? 0;
  const enEdicion = ejecucionActual?.estado === 'en_progreso';

  const todosPasosRespondidos = useMemo(() => {
    if (!casoActual) return false;
    return casoActual.pasos.every((p) => resultadosPaso[p.id]);
  }, [casoActual, resultadosPaso]);

  async function guardarResultado() {
    setGuardando(true);
    setError(null);
    try {
      await ejecucionesApi.registrarResultado(ejecucionActual.id, {
        estado: resultadoGeneral,
        comentario,
        resultadosPaso: Object.entries(resultadosPaso).map(([pasoId, estado]) => ({ pasoId, estado })),
      });
      const nuevaCola = await cargarCola();
      const siguiente = nuevaCola.find((e) => e.estado === 'pendiente' || e.estado === 'en_progreso');
      setSeleccionId(siguiente?.id || null);
      if (!siguiente) {
        setEjecucionActual(null);
        setCasoActual(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function reintentar() {
    setReintentando(true);
    setError(null);
    try {
      await ejecucionesApi.reintentar(ejecucionActual.id);
      const nuevaCola = await cargarCola();
      const item = nuevaCola.find((e) => e.id === ejecucionActual.id);
      const tomada = await ejecucionesApi.tomar(item.id);
      setResultadosPaso({});
      setResultadoGeneral(null);
      setComentario('');
      setEjecucionActual(tomada);
      setCasoActual(item.caso);
      setSeleccionId(item.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setReintentando(false);
    }
  }

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!cola) return <div className="center-state">Cargando ejecución&hellip;</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 32px', borderBottom: '1px solid var(--border)' }}>
        <Link to="/fases" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>
          <IconArrowLeft />
          {ciclo?.nombre}
        </Link>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, maxWidth: 280 }}>
          <div className="progress-bar progress-bar--thin" style={{ flex: 1 }}>
            <div style={{ width: `${totalCasos ? (ejecutados / totalCasos) * 100 : 0}%`, background: 'var(--primary)' }} />
          </div>
          <span style={{ fontSize: 12.5, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{ejecutados}/{totalCasos} ejecutados</span>
        </div>
        <div style={{ flex: 1 }} />
        <Link to="/fases" className="btn btn-ghost btn-sm">Salir</Link>
      </div>

      <div style={{ flex: 1, display: 'flex' }}>
        <div style={{ width: 300, flex: '0 0 auto', borderRight: '1px solid var(--border)', overflowY: 'auto', padding: 10 }}>
          {cola.map((e) => {
            const Icon = e.estado === 'pendiente' || e.estado === 'en_progreso' ? IconClock : ESTADO_ICON[e.estado];
            const activo = e.id === seleccionId;
            const color = activo ? 'var(--primary)' : e.estado === 'pendiente' || e.estado === 'en_progreso' ? 'var(--text-2)' : ESTADO_COLOR[e.estado];
            return (
              <div
                key={e.id}
                onClick={() => setSeleccionId(e.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 8, marginBottom: 4, cursor: 'pointer',
                  background: activo ? 'var(--primary-tint)' : 'transparent',
                  border: `1px solid ${activo ? 'var(--primary)' : 'var(--border)'}`,
                }}
              >
                <Icon size={18} color={color} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: activo ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {e.caso?.titulo}
                  </div>
                  <div style={{ marginTop: 3 }}>
                    <TipoPruebaBadge tipoPrueba={tiposPrueba?.find((t) => t.id === e.tipoPruebaId)} size="sm" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ flex: 1, padding: '28px 40px', maxWidth: 760 }}>
          {!casoActual && !cargandoDetalle && (
            <div className="center-state">Todos los casos de este ciclo tienen ya un resultado.</div>
          )}
          {cargandoDetalle && <div className="center-state">Cargando caso&hellip;</div>}

          {casoActual && !cargandoDetalle && (
            <>
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
                  Prioridad {casoActual.prioridad}
                </div>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{casoActual.titulo}</h1>
              </div>

              {casoActual.pasos.map((p, i) => (
                <div key={p.id} style={{ padding: '18px 0', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 999, background: 'var(--bg-alt)', color: 'var(--text-2)', fontSize: 11.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                      {i + 1}
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{p.accion}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>&rarr; {p.resultadoEsperado}</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginLeft: 32 }}>
                    {PASO_OPCIONES.map((op) => {
                      const seleccionado = resultadosPaso[p.id] === op.valor;
                      return (
                        <button
                          key={op.valor}
                          disabled={!enEdicion}
                          onClick={() => setResultadosPaso((prev) => ({ ...prev, [p.id]: op.valor }))}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 8px',
                            borderRadius: 10, border: `1.5px solid ${seleccionado ? op.color : 'var(--border)'}`,
                            background: seleccionado ? op.color : 'var(--bg-elevated)',
                            color: seleccionado ? 'white' : op.color, fontSize: 12.5, fontWeight: 600, cursor: enEdicion ? 'pointer' : 'default',
                          }}
                        >
                          <op.Icon size={18} color={seleccionado ? 'white' : op.color} />
                          {op.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Resultado de la ejecución</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
                  {RESULTADO_OPCIONES.map((op) => {
                    const seleccionado = resultadoGeneral === op.valor;
                    return (
                      <button
                        key={op.valor}
                        disabled={!enEdicion}
                        onClick={() => setResultadoGeneral(op.valor)}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 8px',
                          borderRadius: 10, border: `1.5px solid ${seleccionado ? op.color : 'var(--border)'}`,
                          background: seleccionado ? op.color : 'var(--bg-elevated)',
                          color: seleccionado ? 'white' : op.color, fontSize: 12.5, fontWeight: 600, cursor: enEdicion ? 'pointer' : 'default',
                        }}
                      >
                        <op.Icon size={18} color={seleccionado ? 'white' : op.color} />
                        {op.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="field" style={{ marginTop: 20 }}>
                <label htmlFor="comentario-general">Comentario general</label>
                <textarea id="comentario-general" rows={3} value={comentario} onChange={(e) => setComentario(e.target.value)} disabled={!enEdicion} />
              </div>

              {enEdicion && (
                <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                  <button className="btn btn-danger-outline" onClick={() => setModalDefecto(true)}>
                    <IconWarning size={15} />
                    Reportar defecto
                  </button>
                  <div style={{ flex: 1 }} />
                  <button
                    className="btn btn-primary"
                    disabled={!todosPasosRespondidos || !resultadoGeneral || guardando}
                    onClick={guardarResultado}
                  >
                    {guardando ? 'Guardando…' : 'Guardar resultado'}
                  </button>
                </div>
              )}

              {!enEdicion && ['failed', 'blocked'].includes(ejecucionActual?.estado) && (
                <div style={{ display: 'flex', marginTop: 22 }}>
                  <button className="btn btn-primary" disabled={reintentando} onClick={reintentar}>
                    {reintentando ? 'Reiniciando…' : 'Reintentar'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {modalDefecto && (
        <DefectoFormModal
          ejecucionId={ejecucionActual.id}
          tipoPrueba={tiposPrueba?.find((t) => t.id === ejecucionActual.tipoPruebaId)}
          onClose={() => setModalDefecto(false)}
          onCreado={() => setModalDefecto(false)}
        />
      )}
    </div>
  );
}
