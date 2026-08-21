import { NavLink } from 'react-router-dom';
import { IconHome, IconList, IconLayers, IconDownload } from './icons';

const NAV_ITEMS = [
  { to: '/', label: 'Inicio', Icon: IconHome, end: true },
  { to: '/casos', label: 'Casos', Icon: IconList },
  { to: '/fases', label: 'Fases', Icon: IconLayers },
  { to: '/resultados', label: 'Result.', Icon: IconDownload },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(({ to, label, Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => `bottom-nav__item${isActive ? ' active' : ''}`}>
          <Icon size={20} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
