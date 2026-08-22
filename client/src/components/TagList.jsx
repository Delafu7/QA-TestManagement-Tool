import { useEffect, useState } from 'react';
import { etiquetasApi } from '../api/etiquetasApi';

export default function TagList({ proyectoId, etiquetaIds }) {
  const [tags, setTags] = useState(null);

  useEffect(() => {
    etiquetasApi.list(proyectoId).then(({ data }) => setTags(data)).catch(() => setTags([]));
  }, [proyectoId]);

  if (!etiquetaIds || etiquetaIds.length === 0) return null;
  const activas = (tags || []).filter((t) => etiquetaIds.includes(t.id));
  if (tags !== null && activas.length === 0) return null;

  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6 }}>
      {activas.map((t) => (
        <span
          key={t.id}
          className="badge"
          style={{ background: t.color + '22', color: t.color, padding: '3px 9px', fontSize: 11 }}
        >
          {t.nombre}
        </span>
      ))}
    </span>
  );
}
