import { useEffect, useState } from 'react';
import { tiposPruebaApi } from '../api/tiposPruebaApi';

export default function TipoPruebaSelect({ proyectoId, value, onChange }) {
  const [tipos, setTipos] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    tiposPruebaApi.list(proyectoId).then((data) => setTipos(data)).catch((e) => setError(e.message));
  }, [proyectoId]);

  // Un tipo archivado ya no se puede elegir de nuevo, pero si el caso lo tenía
  // asignado se sigue mostrando para no perder de vista el valor actual.
  const visibles = (tipos || []).filter((t) => !t.archivado || t.id === value);

  return (
    <div className="field">
      <label>Tipo de prueba</label>
      {error && <div className="alert alert-error">{error}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {tipos === null && <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>Cargando…</span>}
        {visibles.map((t) => {
          const activo = value === t.id;
          return (
            <button
              type="button"
              key={t.id}
              onClick={() => onChange(t.id)}
              className="chip"
              style={{
                borderColor: activo ? t.color : 'var(--border)',
                background: activo ? t.color + '22' : 'var(--bg-elevated)',
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: 999, background: t.color, flex: '0 0 auto' }} />
              {t.nombre}
            </button>
          );
        })}
        {tipos?.length === 0 && (
          <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>Este proyecto todavía no tiene tipos de prueba.</span>
        )}
      </div>
    </div>
  );
}
