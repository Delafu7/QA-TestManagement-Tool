import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProyecto } from '../../context/ProyectoContext';
import { useUsuario } from '../../context/UsuarioContext';
import { useFetch } from '../../hooks/useFetch';
import { proyectosApi } from '../../api/proyectosApi';
import { ciclosApi } from '../../api/ciclosApi';
import { defectosApi } from '../../api/defectosApi';
import EstadoBadge from '../../components/EstadoBadge';
import TipoPruebaBadge from '../../components/TipoPruebaBadge';
import DefectoDetalleModal from '../../components/DefectoDetalleModal';
import CasoDiffModal from './CasoDiffModal';
import { pct } from '../../utils/metrics';
import { IconLayers, IconCheck, IconTrend, IconBug, IconPlus, IconDownload } from '../../components/icons';

const PERIODOS = [
  { value: 7, label: 'Últimos 7 días' },
  { value: 30, label: 'Últimos 30 días' },
  { value: 90, label: 'Últimos 90 días' },
];

function isoFechaHace(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

function hoyIso() {
  return new Date().toISOString().slice(0, 10);
}

function Kpi({ label, value, Icon, color, bg }) {
  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 500 }}>{label}</div>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={15} color={color} />
        </div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const { proyectoId, proyectoActual, cargando: cargandoProyecto } = useProyecto();
  const { usuario } = useUsuario();
  const isGestor = usuario?.rol === 'gestor';

  const { data: proyectoDetalle } = useFetch(
    () => (proyectoId ? proyectosApi.getById(proyectoId) : Promise.resolve(null)),
    [proyectoId]
  );

  const { data: ciclos } = useFetch(
    () => (proyectoId ? ciclosApi.list(proyectoId) : Promise.resolve({ data: [] })),
    [proyectoId]
  );

  const cicloActivoResumen = ciclos?.data.find((c) => c.estado === 'en_progreso') || null;

  const { data: cicloActivo } = useFetch(
    () => (cicloActivoResumen ? ciclosApi.getById(cicloActivoResumen.id) : Promise.resolve(null)),
    [cicloActivoResumen?.id]
  );

  const { data: totalDefectosAbiertos, refetch: recargarDefectosAbiertos } = useFetch(
    () => (proyectoId ? defectosApi.count(proyectoId, { estado: 'abierto' }) : Promise.resolve(0)),
    [proyectoId]
  );

  const [filtroTipoPruebaDefecto, setFiltroTipoPruebaDefecto] = useState('');

  const { data: defectosRecientes, refetch: recargarDefectos } = useFetch(
    () => (proyectoId ? defectosApi.list(proyectoId, { tipoPruebaId: filtroTipoPruebaDefecto }) : Promise.resolve({ data: [] })),
    [proyectoId, filtroTipoPruebaDefecto]
  );

  const { data: resumenTipos } = useFetch(
    () => (proyectoId ? proyectosApi.resumenPorTipoPrueba(proyectoId) : Promise.resolve([])),
    [proyectoId]
  );

  const [defectoAbierto, setDefectoAbierto] = useState(null);
  const [casoDiffAbierto, setCasoDiffAbierto] = useState(null);
  const [periodoDias, setPeriodoDias] = useState(7);

  const { data: casosModificados } = useFetch(
    () =>
      proyectoId
        ? proyectosApi.casosModificados(proyectoId, { desde: isoFechaHace(periodoDias), hasta: hoyIso() })
        : Promise.resolve({ data: [], pagination: { total: 0 } }),
    [proyectoId, periodoDias]
  );

  const { data: cobertura } = useFetch(
    () => (isGestor && cicloActivoResumen ? ciclosApi.coberturaPorSuite(cicloActivoResumen.id) : Promise.resolve(null)),
    [isGestor, cicloActivoResumen?.id]
  );

  if (cargandoProyecto) return <div className="center-state">Cargando&hellip;</div>;

  if (!proyectoActual) {
    return (
      <div className="center-state">
        <p>Todavía no hay ningún proyecto.</p>
        <Link to="/casos" className="btn btn-primary">Crear el primer proyecto</Link>
      </div>
    );
  }

  const tasaExito = cicloActivo?.tasaExito != null ? Math.round(cicloActivo.tasaExito * 100) + '%' : '—';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <div className="page-subtitle">{proyectoActual.nombre} &middot; vista de {usuario.rol}</div>
        </div>
        {!isGestor && cicloActivoResumen && (
          <Link to="/fases" className="btn btn-primary">
            <IconPlus size={15} color="white" />
            Continuar ejecutando
          </Link>
        )}
        {isGestor && (
          <Link to="/resultados" className="btn btn-ghost">
            <IconDownload size={15} />
            Exportar resultados
          </Link>
        )}
      </div>

      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, marginBottom: 24 }}>
        <Kpi label="Ciclos activos" value={proyectoDetalle?.ciclosActivos ?? '—'} Icon={IconLayers} color="var(--primary)" bg="var(--primary-tint)" />
        <Kpi label="Casos activos" value={proyectoDetalle?.totalCasos ?? '—'} Icon={IconCheck} color="var(--pass)" bg="var(--pass-bg)" />
        <Kpi label="Tasa de éxito" value={tasaExito} Icon={IconTrend} color="var(--pend)" bg="var(--pend-bg)" />
        <Kpi label="Defectos abiertos" value={totalDefectosAbiertos ?? '—'} Icon={IconBug} color="var(--fail)" bg="var(--fail-bg)" />
      </div>

      {ciclos && ciclos.data.length === 0 && !isGestor && (
        <div className="card center-state" style={{ marginBottom: 24 }}>
          <p>Todavía no hay ninguna fase en este proyecto.</p>
          <Link to="/fases" className="btn btn-primary">Crear la primera fase</Link>
        </div>
      )}

      {cicloActivo && (
        <div className="card" style={{ padding: '20px 22px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Avance del ciclo actual</span>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}> &middot; {cicloActivo.nombre}</span>
            </div>
            <Link to="/fases" style={{ fontSize: 12.5, fontWeight: 600 }}>Ver fase &rarr;</Link>
          </div>
          {cicloActivo.totalCasos === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Sin ejecuciones asignadas todavía.</div>
          ) : (
            <>
          <div className="progress-bar" style={{ marginBottom: 12 }}>
            <div style={{ width: `${pct(cicloActivo.passed, cicloActivo.totalCasos)}%`, background: 'var(--pass)' }} />
            <div style={{ width: `${pct(cicloActivo.failed, cicloActivo.totalCasos)}%`, background: 'var(--fail)' }} />
            <div style={{ width: `${pct(cicloActivo.blocked, cicloActivo.totalCasos)}%`, background: 'var(--block)' }} />
            <div style={{ width: `${pct(cicloActivo.pendiente, cicloActivo.totalCasos)}%`, background: 'var(--border)' }} />
          </div>
          <div className="progress-legend">
            <span><span className="progress-legend__dot" style={{ background: 'var(--pass)' }} />Passed: <strong style={{ color: 'var(--text)' }}>{cicloActivo.passed}</strong></span>
            <span><span className="progress-legend__dot" style={{ background: 'var(--fail)' }} />Failed: <strong style={{ color: 'var(--text)' }}>{cicloActivo.failed}</strong></span>
            <span><span className="progress-legend__dot" style={{ background: 'var(--block)' }} />Blocked: <strong style={{ color: 'var(--text)' }}>{cicloActivo.blocked}</strong></span>
            <span><span className="progress-legend__dot" style={{ background: 'var(--border)' }} />Pendiente: <strong style={{ color: 'var(--text)' }}>{cicloActivo.pendiente}</strong></span>
            <span style={{ marginLeft: 'auto' }}>{Math.round(cicloActivo.tasaAvance * 100)}% completado</span>
          </div>
            </>
          )}
        </div>
      )}

      {isGestor && cicloActivoResumen && (
        <div className="card" style={{ padding: '18px 20px', marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Cobertura por suite &middot; ciclo actual</div>
          {cobertura === null && <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Cargando&hellip;</div>}
          {cobertura?.data.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Este proyecto todavía no tiene suites.</div>}
          {cobertura?.data.map((s) => (
            <div key={s.suiteId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
              <div style={{ flex: '0 0 160px', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.suiteNombre}</div>
              {s.pctCobertura === null ? (
                <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>Sin casos activos</div>
              ) : (
                <>
                  <div className="progress-bar" style={{ flex: 1 }}>
                    <div style={{ width: `${s.pctCobertura}%`, background: 'var(--primary)' }} />
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, flex: '0 0 auto' }}>{s.pctCobertura}%</div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ padding: '18px 20px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            Casos modificados <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>({casosModificados?.pagination.total ?? '—'})</span>
          </div>
          <select className="chip" value={periodoDias} onChange={(e) => setPeriodoDias(Number(e.target.value))}>
            {PERIODOS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        {casosModificados?.pagination.total === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Sin cambios en casos en este periodo.</div>
        )}
        {casosModificados?.data.map((c) => (
          <div
            key={c.casoId}
            onClick={() => setCasoDiffAbierto(c.casoId)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.casoTitulo}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{c.suiteNombre}</div>
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{c.numCambios} cambio{c.numCambios === 1 ? '' : 's'}</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{c.ultimaModificacion.slice(0, 10)}</span>
          </div>
        ))}
      </div>

      {casoDiffAbierto && <CasoDiffModal casoId={casoDiffAbierto} onClose={() => setCasoDiffAbierto(null)} />}

      <div className="card" style={{ padding: '18px 20px', marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Resultados por tipo de prueba</div>
        {resumenTipos === null && <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Cargando&hellip;</div>}
        {resumenTipos?.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Este proyecto todavía no tiene tipos de prueba.</div>}
        {resumenTipos?.filter((t) => !t.archivado || t.passed + t.failed + t.blocked + t.skipped > 0).map((t) => {
          const total = t.passed + t.failed + t.blocked + t.skipped;
          return (
            <div key={t.tipoPruebaId} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <TipoPruebaBadge tipoPrueba={t} size="sm" />
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  {total === 0 ? 'sin ejecuciones' : t.tasaExito != null ? `tasa de éxito ${Math.round(t.tasaExito * 100)}%` : 'sin resultado passed/failed'}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-2)' }}>
                  {t.defectosAbiertos} defecto{t.defectosAbiertos === 1 ? '' : 's'} abierto{t.defectosAbiertos === 1 ? '' : 's'}
                </span>
              </div>
              {total > 0 && (
                <div className="progress-bar" style={{ marginBottom: 0 }}>
                  <div style={{ width: `${pct(t.passed, total)}%`, background: 'var(--pass)' }} />
                  <div style={{ width: `${pct(t.failed, total)}%`, background: 'var(--fail)' }} />
                  <div style={{ width: `${pct(t.blocked, total)}%`, background: 'var(--block)' }} />
                  <div style={{ width: `${pct(t.skipped, total)}%`, background: 'var(--border)' }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="two-col" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Últimos defectos</div>
            {resumenTipos?.length > 0 && (
              <select className="chip" value={filtroTipoPruebaDefecto} onChange={(e) => setFiltroTipoPruebaDefecto(e.target.value)}>
                <option value="">Tipo de prueba: todos</option>
                {resumenTipos.map((t) => <option key={t.tipoPruebaId} value={t.tipoPruebaId}>{t.nombre}</option>)}
              </select>
            )}
          </div>
          {defectosRecientes?.data.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Sin defectos registrados.</div>}
          {defectosRecientes?.data.slice(0, 5).map((d) => (
            <div
              key={d.id}
              onClick={() => setDefectoAbierto(d.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.titulo}</div>
              </div>
              <TipoPruebaBadge tipoPrueba={resumenTipos?.find((t) => t.tipoPruebaId === d.tipoPruebaId)} size="sm" />
              <span className="badge" style={{ padding: '3px 8px', fontSize: 11, background: sevBg(d.severidad), color: sevColor(d.severidad), textTransform: 'capitalize' }}>{d.severidad}</span>
              <EstadoBadge estado={d.estado} size="sm" />
            </div>
          ))}
        </div>

        {defectoAbierto && (
          <DefectoDetalleModal
            defectoId={defectoAbierto}
            onClose={() => setDefectoAbierto(null)}
            onCambiado={() => { recargarDefectos(); recargarDefectosAbiertos(); }}
          />
        )}

        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Ciclos recientes</div>
          {ciclos?.data.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Sin ciclos todavía.</div>}
          {ciclos?.data.slice(0, 5).map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 8px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{c.fechaInicio} &rarr; {c.fechaFinPrevista}</div>
              </div>
              <EstadoBadge estado={c.estado} size="sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function sevColor(sev) {
  return sev === 'critica' || sev === 'alta' ? 'var(--fail)' : sev === 'media' ? 'var(--block)' : 'var(--skip)';
}
function sevBg(sev) {
  return sev === 'critica' || sev === 'alta' ? 'var(--fail-bg)' : sev === 'media' ? 'var(--block-bg)' : 'var(--skip-bg)';
}
