import { NavLink } from 'react-router-dom';
import { IconHome, IconList, IconLayers, IconDownload, IconChevronDown } from './icons';
import { useUsuario } from '../context/UsuarioContext';
import { useProyecto } from '../context/ProyectoContext';

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
  const { proyectos, proyectoId, seleccionarProyecto } = useProyecto();

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
        <div style={{ position: 'relative' }}>
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
      </div>

      <nav className="sidebar__nav">
        {NAV_ITEMS.map(({ to, label, Icon, end }) => (
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
