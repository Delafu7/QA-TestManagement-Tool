import { useCallback, useEffect, useRef, useState } from 'react';
import { useProyecto } from '../../context/ProyectoContext';
import { runnerApi } from '../../api/runnerApi';
import { ciclosApi } from '../../api/ciclosApi';
import TipoPruebaSelect from '../../components/TipoPruebaSelect';
import EstadoBadge from '../../components/EstadoBadge';

export default function Terminal() {
  const { proyectoId, proyectoActual } = useProyecto();

  const [habilitado, setHabilitado] = useState(null);
  const [comandos, setComandos] = useState([]);
  const [ciclos, setCiclos] = useState([]);

  const [ruta, setRuta] = useState('');
  const [entradas, setEntradas] = useState([]);
  const [cargandoDir, setCargandoDir] = useState(true);
  const [error, setError] = useState(null);

  const [commandId, setCommandId] = useState('');
  const [cicloId, setCicloId] = useState('');
  const [tipoPruebaId, setTipoPruebaId] = useState(null);

  const [runActual, setRunActual] = useState(null);
  const [salida, setSalida] = useState('');
  const [lanzando, setLanzando] = useState(false);
  const [abortando, setAbortando] = useState(false);

  const [historial, setHistorial] = useState(null);

  const streamRef = useRef(null);
  const outputRef = useRef(null);

  useEffect(() => {
    runnerApi.status().then((res) => setHabilitado(res.habilitado)).catch(() => setHabilitado(false));
  }, []);

  useEffect(() => {
    if (!habilitado) return;
    runnerApi.comandos().then(setComandos).catch((e) => setError(e.message));
  }, [habilitado]);

  useEffect(() => {
    if (!habilitado || !proyectoId) return;
    ciclosApi.list(proyectoId).then(({ data }) => setCiclos(data)).catch(() => setCiclos([]));
  }, [habilitado, proyectoId]);

  const cargarDirectorio = useCallback((nuevaRuta) => {
    setCargandoDir(true);
    runnerApi
      .directorio(nuevaRuta)
      .then((res) => {
        setRuta(res.directorio);
        setEntradas(res.entradas);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargandoDir(false));
  }, []);

  useEffect(() => {
    if (habilitado) cargarDirectorio('');
  }, [habilitado, cargarDirectorio]);

  const cargarHistorial = useCallback(() => {
    if (!habilitado || !proyectoId) return;
    runnerApi.list({ proyectoId }).then(setHistorial).catch((e) => setError(e.message));
  }, [habilitado, proyectoId]);

  useEffect(() => {
    cargarHistorial();
  }, [cargarHistorial]);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [salida]);

  useEffect(() => () => streamRef.current?.abort(), []);

  const entrarEn = (nombre) => {
    setError(null);
    runnerApi
      .cd(ruta, nombre)
      .then((res) => {
        setRuta(res.directorio);
        setEntradas(res.entradas);
      })
      .catch((e) => setError(e.message));
  };

  const segmentos = ruta ? ruta.split('/') : [];

  async function ejecutar() {
    setError(null);
    setLanzando(true);
    setSalida('');
    try {
      const run = await runnerApi.iniciar({
        proyectoId,
        cicloId: cicloId || undefined,
        tipoPruebaId: tipoPruebaId || undefined,
        directorioRelativo: ruta,
        commandId,
      });
      setRunActual(run);
      streamRef.current?.abort();
      streamRef.current = runnerApi.stream(run.id, ({ event, data }) => {
        if (event === 'output') setSalida((prev) => prev + data.chunk);
        if (event === 'end') {
          setRunActual((prev) => (prev ? { ...prev, estado: data.estado, codigoSalida: data.codigoSalida, salidaTruncada: data.salidaTruncada } : prev));
          cargarHistorial();
        }
        if (event === 'error') setError(data.message);
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLanzando(false);
    }
  }

  async function abortar() {
    if (!runActual) return;
    setAbortando(true);
    try {
      await runnerApi.abortar(runActual.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setAbortando(false);
    }
  }

  if (habilitado === null) return <div className="center-state">Cargando&hellip;</div>;
  if (!habilitado) return <div className="center-state">El runner de terminal no está habilitado en este servidor.</div>;
  if (!proyectoActual) return <div className="center-state">Selecciona un proyecto para usar la terminal.</div>;

  const enEjecucion = runActual?.estado === 'en_progreso';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Terminal</h1>
          <div className="page-subtitle">{proyectoActual.nombre}</div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 12, fontSize: 12.5 }}>
          <span
            style={{ cursor: 'pointer', color: ruta ? 'var(--primary)' : 'var(--text)', fontWeight: ruta ? 500 : 700 }}
            onClick={() => cargarDirectorio('')}
          >
            /workspace
          </span>
          {segmentos.map((seg, i) => {
            const prefijo = segmentos.slice(0, i + 1).join('/');
            const esUltimo = i === segmentos.length - 1;
            return (
              <span key={prefijo} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--text-2)' }}>/</span>
                <span
                  style={{ cursor: esUltimo ? 'default' : 'pointer', fontWeight: esUltimo ? 700 : 500, color: esUltimo ? 'var(--text)' : 'var(--primary)' }}
                  onClick={() => !esUltimo && cargarDirectorio(prefijo)}
                >
                  {seg}
                </span>
              </span>
            );
          })}
        </div>

        {cargandoDir && <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>Cargando directorio&hellip;</div>}
        {!cargandoDir && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {entradas.filter((e) => e.tipo === 'directorio').map((e) => (
              <button key={e.nombre} type="button" className="chip" onClick={() => entrarEn(e.nombre)}>
                {e.nombre}/
              </button>
            ))}
            {entradas.filter((e) => e.tipo === 'directorio').length === 0 && (
              <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>Este directorio no tiene subcarpetas.</span>
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
          <div className="field">
            <label htmlFor="runner-comando">Comando</label>
            <select id="runner-comando" value={commandId} onChange={(e) => setCommandId(e.target.value)}>
              <option value="">Selecciona&hellip;</option>
              {comandos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="runner-ciclo">Fase (opcional)</label>
            <select id="runner-ciclo" value={cicloId} onChange={(e) => setCicloId(e.target.value)}>
              <option value="">Ninguna</option>
              {ciclos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <TipoPruebaSelect proyectoId={proyectoId} value={tipoPruebaId} onChange={setTipoPruebaId} />

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button className="btn btn-primary" disabled={!commandId || lanzando || enEjecucion} onClick={ejecutar}>
            {lanzando ? 'Lanzando…' : 'Ejecutar'}
          </button>
          {enEjecucion && (
            <button className="btn btn-danger-outline" disabled={abortando} onClick={abortar}>
              {abortando ? 'Abortando…' : 'Abortar'}
            </button>
          )}
        </div>
      </div>

      {runActual && (
        <div className="card" style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            <EstadoBadge estado={runActual.estado} />
            <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
              {runActual.comando} {(runActual.argumentos || []).join(' ')}
            </span>
            {runActual.salidaTruncada && <span style={{ fontSize: 11.5, color: 'var(--block)' }}>salida truncada</span>}
          </div>
          <pre
            ref={outputRef}
            style={{
              background: 'var(--bg-alt)',
              color: 'var(--text)',
              padding: 14,
              borderRadius: 8,
              maxHeight: 380,
              overflow: 'auto',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: 12.5,
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {salida || '(sin salida todavía)'}
          </pre>
        </div>
      )}

      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Historial de ejecuciones</div>
        {!historial && <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>Cargando&hellip;</div>}
        {historial?.data.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>Todavía no se ha ejecutado nada en este proyecto.</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {historial?.data.map((r) => (
            <div
              key={r.id}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: 12.5, flexWrap: 'wrap' }}
            >
              <EstadoBadge estado={r.estado} size="sm" />
              <span style={{ color: 'var(--text-2)' }}>{r.directorioRelativo || '/'}</span>
              <span style={{ fontWeight: 500 }}>
                {r.comando} {(r.argumentos || []).join(' ')}
              </span>
              <div style={{ flex: 1 }} />
              <span style={{ color: 'var(--text-2)' }}>{new Date(r.iniciadoEn).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
