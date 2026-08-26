export default function TipoPruebaBadge({ tipoPrueba, size = 'md' }) {
  const padding = size === 'sm' ? '3px 8px' : '4px 10px';
  const fontSize = size === 'sm' ? 11 : 11.5;

  if (!tipoPrueba) {
    return (
      <span className="badge" style={{ background: 'var(--skip-bg)', color: 'var(--skip)', padding, fontSize }}>
        Sin tipo
      </span>
    );
  }

  return (
    <span className="badge" style={{ background: tipoPrueba.color + '22', color: tipoPrueba.color, padding, fontSize }}>
      {tipoPrueba.nombre}
    </span>
  );
}
