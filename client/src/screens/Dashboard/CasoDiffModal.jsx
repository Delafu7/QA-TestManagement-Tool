import { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import { casosApi } from '../../api/casosApi';

const CAMPOS = [
  { key: 'titulo', label: 'Título' },
  { key: 'descripcion', label: 'Descripción' },
  { key: 'precondiciones', label: 'Precondiciones' },
  { key: 'prioridad', label: 'Prioridad' },
  { key: 'tipo', label: 'Tipo' },
];

function diffCampos(antes, despues) {
  return CAMPOS.map((c) => ({ ...c, antes: antes[c.key] ?? '—', despues: despues[c.key] ?? '—' })).filter(
    (c) => c.antes !== c.despues
  );
}

function diffPasos(antes, despues) {
  const max = Math.max(antes.length, despues.length);
  const filas = [];
  for (let i = 0; i < max; i++) {
    const a = antes[i];
    const d = despues[i];
    if (!a && d) filas.push({ orden: d.orden, tipo: 'añadido', antes: null, despues: d });
    else if (a && !d) filas.push({ orden: a.orden, tipo: 'eliminado', antes: a, despues: null });
    else if (a.accion !== d.accion || a.resultadoEsperado !== d.resultadoEsperado) {
      filas.push({ orden: d.orden, tipo: 'cambiado', antes: a, despues: d });
    }
  }
  return filas;
}

export default function CasoDiffModal({ casoId, onClose }) {
  const [estado, setEstado] = useState(null); // { antes, despues, editadoPorId, fecha } | 'sin-cambios'
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([casosApi.versiones(casoId), casosApi.getById(casoId)])
      .then(([versiones, actual]) => {
        if (versiones.length === 0) {
          setEstado('sin-cambios');
          return;
        }
        const ultima = versiones[versiones.length - 1];
        setEstado({ antes: ultima, despues: actual, editadoPorId: ultima.editadoPorId, fecha: ultima.creadoEn, numVersiones: versiones.length });
      })
      .catch((e) => setError(e.message));
  }, [casoId]);

  const camposCambiados = estado && estado !== 'sin-cambios' ? diffCampos(estado.antes, estado.despues) : [];
  const pasosCambiados = estado && estado !== 'sin-cambios' ? diffPasos(estado.antes.pasos, estado.despues.pasos) : [];

  return (
    <Modal title={estado && estado !== 'sin-cambios' ? `Cambios — ${estado.despues.titulo}` : 'Historial de cambios'} onClose={onClose} width={560}>
      {error && <div className="alert alert-error">{error}</div>}
      {!estado && !error && <div className="center-state">Cargando&hellip;</div>}
      {estado === 'sin-cambios' && <div className="center-state">Este caso todavía no tiene cambios registrados.</div>}

      {estado && estado !== 'sin-cambios' && (
        <div>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 14 }}>
            Última edición: {estado.fecha.slice(0, 10)} &middot; {estado.numVersiones} cambio{estado.numVersiones === 1 ? '' : 's'} en total
          </div>

          {camposCambiados.length === 0 && pasosCambiados.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Sin diferencias de contenido en el último cambio.</div>
          )}

          {camposCambiados.map((c) => (
            <div key={c.key} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 13, padding: '6px 10px', background: 'var(--fail-bg)', color: 'var(--fail)', borderRadius: 6, marginBottom: 4, textDecoration: 'line-through' }}>
                {c.antes}
              </div>
              <div style={{ fontSize: 13, padding: '6px 10px', background: 'var(--pass-bg)', color: 'var(--pass)', borderRadius: 6 }}>
                {c.despues}
              </div>
            </div>
          ))}

          {pasosCambiados.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Pasos</div>
              {pasosCambiados.map((p, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginBottom: 3 }}>
                    Paso {p.orden} &middot; {p.tipo}
                  </div>
                  {p.antes && (
                    <div style={{ fontSize: 12.5, padding: '5px 10px', background: 'var(--fail-bg)', color: 'var(--fail)', borderRadius: 6, marginBottom: 3, textDecoration: p.tipo === 'eliminado' ? 'none' : 'line-through' }}>
                      {p.antes.accion} &rarr; {p.antes.resultadoEsperado}
                    </div>
                  )}
                  {p.despues && (
                    <div style={{ fontSize: 12.5, padding: '5px 10px', background: 'var(--pass-bg)', color: 'var(--pass)', borderRadius: 6 }}>
                      {p.despues.accion} &rarr; {p.despues.resultadoEsperado}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
