import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProyecto } from '../../context/ProyectoContext';
import { useUsuario } from '../../context/UsuarioContext';
import { useFetch } from '../../hooks/useFetch';
import { proyectosApi } from '../../api/proyectosApi';
import { ciclosApi } from '../../api/ciclosApi';
import { defectosApi } from '../../api/defectosApi';
import EstadoBadge from '../../components/EstadoBadge';
import DefectoDetalleModal from '../../components/DefectoDetalleModal';
import { IconLayers, IconCheck, IconTrend, IconBug, IconPlus, IconDownload } from '../../components/icons';

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

  const { data: defectosRecientes, refetch: recargarDefectos } = useFetch(
    () => (proyectoId ? defectosApi.list(proyectoId) : Promise.resolve({ data: [] })),
    [proyectoId]
  );

  const [defectoAbierto, setDefectoAbierto] = useState(null);

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

      {cicloActivo && (
        <div className="card" style={{ padding: '20px 22px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Avance del ciclo actual</span>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}> &middot; {cicloActivo.nombre}</span>
            </div>
            <Link to="/fases" style={{ fontSize: 12.5, fontWeight: 600 }}>Ver fase &rarr;</Link>
          </div>
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
        </div>
      )}

      <div className="two-col" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Últimos defectos</div>
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

function pct(n, total) {
  if (!total) return 0;
  return Math.round((n / total) * 1000) / 10;
}

function sevColor(sev) {
  return sev === 'critica' || sev === 'alta' ? 'var(--fail)' : sev === 'media' ? 'var(--block)' : 'var(--skip)';
}
function sevBg(sev) {
  return sev === 'critica' || sev === 'alta' ? 'var(--fail-bg)' : sev === 'media' ? 'var(--block-bg)' : 'var(--skip-bg)';
}
