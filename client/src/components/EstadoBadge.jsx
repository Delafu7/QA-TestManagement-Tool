import { IconCheck, IconCross, IconBlock, IconSkip, IconClock, IconCircle } from './icons';

const ESTADOS = {
  passed: { color: 'var(--pass)', bg: 'var(--pass-bg)', Icon: IconCheck, label: 'passed' },
  failed: { color: 'var(--fail)', bg: 'var(--fail-bg)', Icon: IconCross, label: 'failed' },
  blocked: { color: 'var(--block)', bg: 'var(--block-bg)', Icon: IconBlock, label: 'blocked' },
  skipped: { color: 'var(--skip)', bg: 'var(--skip-bg)', Icon: IconSkip, label: 'skipped' },
  pendiente: { color: 'var(--pend)', bg: 'var(--pend-bg)', Icon: IconClock, label: 'pendiente' },
  en_progreso: { color: 'var(--pend)', bg: 'var(--pend-bg)', Icon: IconClock, label: 'en progreso' },

  borrador: { color: 'var(--pend)', bg: 'var(--pend-bg)', Icon: IconClock, label: 'borrador' },
  activo: { color: 'var(--pass)', bg: 'var(--pass-bg)', Icon: IconCheck, label: 'activo' },
  obsoleto: { color: 'var(--skip)', bg: 'var(--skip-bg)', Icon: IconSkip, label: 'obsoleto' },

  planificada: { color: 'var(--skip)', bg: 'var(--skip-bg)', Icon: IconCircle, label: 'planificada' },
  bloqueada: { color: 'var(--block)', bg: 'var(--block-bg)', Icon: IconBlock, label: 'bloqueada' },
  completada: { color: 'var(--pass)', bg: 'var(--pass-bg)', Icon: IconCheck, label: 'completada' },

  abierto: { color: 'var(--fail)', bg: 'var(--fail-bg)', Icon: IconCircle, label: 'abierto' },
  resuelto: { color: 'var(--pass)', bg: 'var(--pass-bg)', Icon: IconCheck, label: 'resuelto' },
  cerrado: { color: 'var(--pass)', bg: 'var(--pass-bg)', Icon: IconCheck, label: 'cerrado' },
  reabierto: { color: 'var(--fail)', bg: 'var(--fail-bg)', Icon: IconCircle, label: 'reabierto' },
};

export default function EstadoBadge({ estado, size = 'md' }) {
  const meta = ESTADOS[estado] || { color: 'var(--skip)', bg: 'var(--skip-bg)', Icon: IconCircle, label: estado };
  const { color, bg, Icon, label } = meta;
  const padding = size === 'sm' ? '3px 8px' : '4px 10px';
  const fontSize = size === 'sm' ? 11 : 11.5;
  return (
    <span
      className="badge"
      style={{ background: bg, color, padding, fontSize }}
    >
      <Icon size={size === 'sm' ? 11 : 13} color={color} />
      {label}
    </span>
  );
}
