import { useEffect, useState } from 'react';
import { etiquetasApi } from '../api/etiquetasApi';
import { IconPlus } from './icons';

const COLOR_DEFECTO = '#4F46E5';

export default function TagPicker({ proyectoId, selectedIds, onChange }) {
  const [tags, setTags] = useState(null);
  const [error, setError] = useState(null);
  const [creando, setCreando] = useState(false);
  const [nombreNueva, setNombreNueva] = useState('');
  const [colorNueva, setColorNueva] = useState(COLOR_DEFECTO);

  useEffect(() => {
    etiquetasApi.list(proyectoId).then(({ data }) => setTags(data)).catch((e) => setError(e.message));
  }, [proyectoId]);

  function toggle(id) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  }

  async function crearEtiqueta(e) {
    e.preventDefault();
    if (!nombreNueva.trim()) return;
    try {
      const nueva = await etiquetasApi.create(proyectoId, { nombre: nombreNueva.trim(), color: colorNueva });
      setTags((prev) => [...(prev || []), nueva]);
      onChange([...selectedIds, nueva.id]);
      setNombreNueva('');
      setColorNueva(COLOR_DEFECTO);
      setCreando(false);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="field">
      <label>Etiquetas</label>
      {error && <div className="alert alert-error">{error}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {tags === null && <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>Cargando…</span>}
        {tags?.map((t) => {
          const activa = selectedIds.includes(t.id);
          return (
            <button
              type="button"
              key={t.id}
              onClick={() => toggle(t.id)}
              className="chip"
              style={{
                borderColor: activa ? t.color : 'var(--border)',
                background: activa ? t.color + '22' : 'var(--bg-elevated)',
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: 999, background: t.color, flex: '0 0 auto' }} />
              {t.nombre}
            </button>
          );
        })}
        {tags?.length === 0 && !creando && (
          <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>Este proyecto todavía no tiene etiquetas.</span>
        )}
        {!creando && (
          <button type="button" className="chip" onClick={() => setCreando(true)}>
            <IconPlus size={11} />
            Nueva etiqueta
          </button>
        )}
      </div>
      {creando && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <input
            placeholder="Nombre"
            value={nombreNueva}
            onChange={(e) => setNombreNueva(e.target.value)}
            style={{ flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}
            autoFocus
          />
          <input
            type="color"
            value={colorNueva}
            onChange={(e) => setColorNueva(e.target.value)}
            style={{ width: 34, height: 34, padding: 2, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}
            aria-label="Color de la etiqueta"
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={crearEtiqueta}>Añadir</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCreando(false)}>Cancelar</button>
        </div>
      )}
    </div>
  );
}
