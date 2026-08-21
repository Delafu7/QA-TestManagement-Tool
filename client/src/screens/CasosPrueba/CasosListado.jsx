import { useEffect, useMemo, useState } from 'react';
import { useProyecto } from '../../context/ProyectoContext';
import { useUsuario } from '../../context/UsuarioContext';
import { suitesApi } from '../../api/suitesApi';
import { casosApi } from '../../api/casosApi';
import { flattenSuites } from '../../utils/suites';
import EstadoBadge from '../../components/EstadoBadge';
import { IconPlus, IconSearch } from '../../components/icons';
import CrearProyectoModal from '../../components/CrearProyectoModal';
import CrearSuiteModal from '../../components/CrearSuiteModal';
import CasoFormModal from './CasoFormModal';
import CasoDetalleModal from './CasoDetalleModal';
import AsignarCicloModal from './AsignarCicloModal';

const PRIO_COLOR = { alta: 'var(--fail)', media: 'var(--block)', baja: 'var(--skip)' };

export default function CasosListado() {
  const { proyectoId, proyectoActual, cargando: cargandoProyecto, recargar: recargarProyectos } = useProyecto();
  const { usuario } = useUsuario();
  const isQa = usuario.rol === 'qa';

  const [suites, setSuites] = useState(null);
  const [casos, setCasos] = useState(null);
  const [error, setError] = useState(null);

  const [filtroSuite, setFiltroSuite] = useState('');
  const [filtroPrioridad, setFiltroPrioridad] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const [seleccion, setSeleccion] = useState(new Set());
  const [modal, setModal] = useState(null); // 'crearProyecto' | 'crearSuite' | 'crearCaso' | { casoId } | 'asignarCiclo'

  const suitesFlat = useMemo(() => (suites ? flattenSuites(suites) : []), [suites]);

  async function cargarSuitesYCasos() {
    if (!proyectoId) return;
    setError(null);
    try {
      const { data } = await suitesApi.tree(proyectoId);
      setSuites(data);
      const flat = flattenSuites(data);
      if (flat.length === 0) {
        setCasos([]);
        return;
      }
      const resultados = await Promise.all(flat.map((s) => casosApi.list(s.id).then((r) => r.data.map((c) => ({ ...c, suiteNombre: s.nombre })))));
      setCasos(resultados.flat());
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    setSuites(null);
    setCasos(null);
    cargarSuitesYCasos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId]);

  const casosFiltrados = (casos || []).filter((c) => {
    if (filtroSuite && c.suiteId !== filtroSuite) return false;
    if (filtroPrioridad && c.prioridad !== filtroPrioridad) return false;
    if (filtroTipo && c.tipo !== filtroTipo) return false;
    if (filtroEstado && c.estado !== filtroEstado) return false;
    if (busqueda && !c.titulo.toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });

  function toggleSeleccion(id) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
          <h1 className="page-title">Casos de prueba</h1>
          <div className="page-subtitle">{proyectoActual.nombre} &middot; {casos?.length ?? 0} casos</div>
        </div>
        {isQa && suitesFlat.length > 0 && (
          <button className="btn btn-primary" onClick={() => setModal('crearCaso')}>
            <IconPlus size={15} color="white" />
            Nuevo caso
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {suitesFlat.length === 0 && casos !== null && (
        <div className="center-state">
          <p>Este proyecto todavía no tiene ninguna suite.</p>
          {isQa && <button className="btn btn-primary" onClick={() => setModal('crearSuite')}>Crear la primera suite</button>}
        </div>
      )}

      {suitesFlat.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <select className="chip" value={filtroSuite} onChange={(e) => setFiltroSuite(e.target.value)}>
              <option value="">Suite: todas</option>
              {suitesFlat.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
            <select className="chip" value={filtroPrioridad} onChange={(e) => setFiltroPrioridad(e.target.value)}>
              <option value="">Prioridad: todas</option>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
            <select className="chip" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
              <option value="">Tipo: todos</option>
              <option value="funcional">Funcional</option>
              <option value="regresion">Regresión</option>
              <option value="humo">Humo</option>
              <option value="exploratorio">Exploratorio</option>
            </select>
            <select className="chip" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
              <option value="">Estado: todos</option>
              <option value="borrador">Borrador</option>
              <option value="activo">Activo</option>
              <option value="obsoleto">Obsoleto</option>
            </select>
            <div style={{ flex: 1 }} />
            <div className="search-box">
              <IconSearch />
              <input placeholder="Buscar casos…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </div>
          </div>

          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {isQa && <th style={{ width: 36 }}></th>}
                  <th>Título</th>
                  <th>Suite</th>
                  <th>Prioridad</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {casos === null && (
                  <tr><td colSpan={6}><div className="center-state">Cargando casos&hellip;</div></td></tr>
                )}
                {casos !== null && casosFiltrados.length === 0 && (
                  <tr><td colSpan={6}><div className="center-state">No hay casos que coincidan con los filtros.</div></td></tr>
                )}
                {casosFiltrados.map((c) => (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setModal({ casoId: c.id })}>
                    {isQa && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={seleccion.has(c.id)} onChange={() => toggleSeleccion(c.id)} />
                      </td>
                    )}
                    <td style={{ fontWeight: 500 }}>{c.titulo}</td>
                    <td style={{ color: 'var(--text-2)' }}>{c.suiteNombre}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: 999, background: PRIO_COLOR[c.prioridad], flex: '0 0 auto' }} />
                        {c.prioridad}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-2)', textTransform: 'capitalize' }}>{c.tipo}</td>
                    <td><EstadoBadge estado={c.estado} size="sm" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {isQa && seleccion.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
              <button className="chip" onClick={() => setModal('asignarCiclo')}>Añadir a ciclo ({seleccion.size})</button>
            </div>
          )}
        </>
      )}

      {modal === 'crearSuite' && (
        <CrearSuiteModal
          proyectoId={proyectoId}
          suites={suitesFlat}
          onClose={() => setModal(null)}
          onCreada={async () => { await cargarSuitesYCasos(); setModal(null); }}
        />
      )}

      {modal === 'crearCaso' && (
        <CasoFormModal
          suites={suitesFlat}
          onClose={() => setModal(null)}
          onCreado={async () => { await cargarSuitesYCasos(); setModal(null); }}
        />
      )}

      {modal && typeof modal === 'object' && modal.casoId && (
        <CasoDetalleModal
          casoId={modal.casoId}
          onClose={() => setModal(null)}
          onCambiado={cargarSuitesYCasos}
        />
      )}

      {modal === 'asignarCiclo' && (
        <AsignarCicloModal
          proyectoId={proyectoId}
          casoIds={[...seleccion]}
          onClose={() => setModal(null)}
          onAsignado={() => { setSeleccion(new Set()); setModal(null); }}
        />
      )}
    </div>
  );
}
