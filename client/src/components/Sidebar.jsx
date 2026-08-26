import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { IconHome, IconList, IconLayers, IconDownload, IconTerminal, IconChevronDown, IconSettings } from './icons';
import { useUsuario } from '../context/UsuarioContext';
import { useProyecto } from '../context/ProyectoContext';
import { runnerApi } from '../api/runnerApi';
import AjustesProyectoModal from './AjustesProyectoModal';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', Icon: IconHome, end: true },
  { to: '/casos', label: 'Casos', Icon: IconList },
  { to: '/fases', label: 'Fases', Icon: IconLayers },
  { to: '/resultados', label: 'Resultados', Icon: IconDownload },
];

function initials(nombre) {
  return nombre
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function Sidebar() {
  const { usuario, cerrarSesion } = useUsuario();
  const { proyectos, proyectoId, proyectoActual, seleccionarProyecto, recargar } = useProyecto();
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);
  const [runnerHabilitado, setRunnerHabilitado] = useState(false);
  const isQa = usuario?.rol === 'qa';

  useEffect(() => {
    runnerApi.status().then((res) => setRunnerHabilitado(res.habilitado)).catch(() => setRunnerHabilitado(false));
  }, []);

  const navItems = runnerHabilitado
    ? [...NAV_ITEMS, { to: '/terminal', label: 'Terminal', Icon: IconTerminal }]
    : NAV_ITEMS;

  return (
    <aside className="sidebar">
      <div className="sidebar__logo">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="7" fill="var(--primary)" />
          <path d="M8 14.5l4 4 8-9" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="sidebar__wordmark">QA Tool</span>
      </div>

      <div className="sidebar__project">
        <div className="sidebar__section-label">Proyecto</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <select
              className="project-select"
              value={proyectoId || ''}
              onChange={(e) => seleccionarProyecto(e.target.value)}
              aria-label="Proyecto activo"
            >
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <IconChevronDown color="var(--text-2)" />
            </span>
          </div>
          {isQa && proyectoActual && (
            <button
              type="button"
              className="icon-btn"
              aria-label="Ajustes del proyecto"
              title="Ajustes del proyecto"
              onClick={() => setAjustesAbiertos(true)}
            >
              <IconSettings size={15} />
            </button>
          )}
        </div>
      </div>

      {ajustesAbiertos && proyectoActual && (
        <AjustesProyectoModal
          proyecto={proyectoActual}
          onClose={() => setAjustesAbiertos(false)}
          onGuardado={async () => { await recargar(); setAjustesAbiertos(false); }}
          onArchivado={async () => { await recargar(); setAjustesAbiertos(false); }}
        />
      )}

      <nav className="sidebar__nav">
        {navItems.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <Icon size={18} />
            <span className="nav-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      {usuario && (
        <div className="sidebar__user">
          <div className="avatar">{initials(usuario.nombre)}</div>
          <div style={{ minWidth: 0 }}>
            <div className="sidebar__user-name">{usuario.nombre}</div>
            <button className="sidebar__user-role" onClick={cerrarSesion} title="Cambiar de usuario">
              {usuario.rol}
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
