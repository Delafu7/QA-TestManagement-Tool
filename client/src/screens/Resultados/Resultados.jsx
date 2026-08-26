import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProyecto } from '../../context/ProyectoContext';
import { useFetch } from '../../hooks/useFetch';
import { ciclosApi } from '../../api/ciclosApi';
import { exportApi } from '../../api/exportApi';
import EstadoBadge from '../../components/EstadoBadge';
import TipoPruebaBadge from '../../components/TipoPruebaBadge';
import { IconFileJson, IconFileMd, IconNotion } from '../../components/icons';
import NotionExportModal from './NotionExportModal';

export default function Resultados() {
  const { cicloId: cicloIdParam } = useParams();
  const navigate = useNavigate();
  const { proyectoId, proyectoActual, cargando: cargandoProyecto } = useProyecto();

  const { data: ciclos } = useFetch(
    () => (proyectoId ? ciclosApi.list(proyectoId) : Promise.resolve({ data: [] })),
    [proyectoId]
  );

  const cicloId = cicloIdParam || ciclos?.data[0]?.id;

  const { data: payload, loading, error } = useFetch(
    () => (cicloId ? exportApi.getJson(cicloId) : Promise.resolve(null)),
    [cicloId]
  );

  const [descargando, setDescargando] = useState(null);
  const [modalNotion, setModalNotion] = useState(false);

  async function exportar(tipo) {
    setDescargando(tipo);
    try {
      if (tipo === 'json') await exportApi.downloadJson(cicloId);
      if (tipo === 'markdown') await exportApi.downloadMarkdown(cicloId);
    } finally {
      setDescargando(null);
    }
  }

  if (cargandoProyecto) return <div className="center-state">Cargando&hellip;</div>;
  if (!proyectoActual) return <div className="center-state">Todavía no hay ningún proyecto.</div>;
  if (ciclos?.data.length === 0) return <div className="center-state">Todavía no hay ninguna fase con resultados.</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Resultados{payload ? ` — ${payload.ciclo.nombre}` : ''}</h1>
          <div className="page-subtitle">
            {payload && (
              <>
                {payload.resumen.totalCasos} ejecuciones &middot; {payload.resumen.passed} passed &middot; {payload.resumen.failed} failed &middot; {payload.resumen.blocked} blocked
                {payload.resumen.tasaExito != null && <> &middot; tasa de éxito {Math.round(payload.resumen.tasaExito * 100)}%</>}
              </>
            )}
          </div>
        </div>
        <select
          className="chip"
          value={cicloId || ''}
          onChange={(e) => navigate(`/resultados/${e.target.value}`)}
        >
          {ciclos?.data.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      {error && <div className="alert alert-error">{error.message}</div>}
      {loading && <div className="center-state">Cargando resultados&hellip;</div>}

      {payload && (
        <>
          <div className="data-table-wrap" style={{ marginBottom: 24 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Caso</th>
                  <th>Suite</th>
                  <th>Tipo de prueba</th>
                  <th>Estado</th>
                  <th>Ejecutor</th>
                  <th>Fecha</th>
                  <th>Defecto</th>
                </tr>
              </thead>
              <tbody>
                {payload.ejecuciones.length === 0 && (
                  <tr><td colSpan={7}><div className="center-state">Este ciclo todavía no tiene ejecuciones.</div></td></tr>
                )}
                {payload.ejecuciones.map((e) => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 500 }}>{e.casoTitulo}</td>
                    <td style={{ color: 'var(--text-2)' }}>{e.suiteNombre}</td>
                    <td><TipoPruebaBadge tipoPrueba={e.tipoPrueba} size="sm" /></td>
                    <td><EstadoBadge estado={e.estado} size="sm" /></td>
                    <td style={{ color: 'var(--text-2)' }}>{e.ejecutor || '—'}</td>
                    <td style={{ color: 'var(--text-2)' }}>{e.fechaEjecucion ? e.fechaEjecucion.slice(0, 10) : '—'}</td>
                    <td>
                      {e.defectos.length > 0 ? (
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--primary)' }}>#{e.defectos[0].id.slice(0, 6)}</span>
                      ) : (
                        <span style={{ color: 'var(--skip)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Exportar como</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', flex: 1, minWidth: 220, cursor: 'pointer' }} disabled={descargando} onClick={() => exportar('json')}>
                <span style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--primary-tint)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                  <IconFileJson />
                </span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>JSON</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-2)' }}>Datos completos, por paso</div>
                </div>
              </button>
              <button className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', flex: 1, minWidth: 220, cursor: 'pointer' }} disabled={descargando} onClick={() => exportar('markdown')}>
                <span style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--primary-tint)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                  <IconFileMd />
                </span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>Markdown</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-2)' }}>Tabla lista para pegar</div>
                </div>
              </button>
              <button className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', flex: 1, minWidth: 220, cursor: 'pointer' }} onClick={() => setModalNotion(true)}>
                <span style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--primary-tint)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                  <IconNotion />
                </span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>Enviar a Notion</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-2)' }}>Una página por ejecución</div>
                </div>
              </button>
            </div>
          </div>
        </>
      )}

      {modalNotion && <NotionExportModal cicloId={cicloId} onClose={() => setModalNotion(false)} />}
    </div>
  );
}
