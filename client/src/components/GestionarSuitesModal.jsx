import { useEffect, useState } from 'react';
import Modal from './Modal';
import { suitesApi } from '../api/suitesApi';

function flattenWithDepth(tree, depth = 0, out = []) {
  for (const s of tree) {
    out.push({ ...s, depth });
    if (s.hijas?.length) flattenWithDepth(s.hijas, depth + 1, out);
  }
  return out;
}

function descendantIds(suite, acc = new Set()) {
  acc.add(suite.id);
  (suite.hijas || []).forEach((h) => descendantIds(h, acc));
  return acc;
}

function SuiteRow({ suite, filas, onGuardado, onEliminado }) {
  const [nombre, setNombre] = useState(suite.nombre);
  const [suitePadreId, setSuitePadreId] = useState(suite.suitePadreId || '');
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState(null);

  const sucias = nombre !== suite.nombre || suitePadreId !== (suite.suitePadreId || '');
  const excluidos = descendantIds(suite);
  const opcionesPadre = filas.filter((f) => !excluidos.has(f.id));

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const actualizada = await suitesApi.update(suite.id, {
        nombre,
        suitePadreId: suitePadreId || null,
      });
      onGuardado(actualizada);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    setEliminando(true);
    setError(null);
    try {
      await suitesApi.remove(suite.id);
      onEliminado(suite.id);
    } catch (err) {
      setError(err.message);
      setEliminando(false);
      setConfirmando(false);
    }
  }

  return (
    <div style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
      {error && <div className="alert alert-error" style={{ marginBottom: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingLeft: suite.depth * 18 }}>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          style={{ flex: 1, padding: '7px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}
        />
        <select
          value={suitePadreId}
          onChange={(e) => setSuitePadreId(e.target.value)}
          style={{ width: 200 }}
        >
          <option value="">Ninguna (raíz)</option>
          {opcionesPadre.map((f) => (
            <option key={f.id} value={f.id}>{'—'.repeat(f.depth)} {f.nombre}</option>
          ))}
        </select>
        <button type="button" className="btn btn-primary btn-sm" disabled={!sucias || guardando} onClick={guardar}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        {!confirmando && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmando(true)}>
            Eliminar
          </button>
        )}
        {confirmando && (
          <>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>¿Seguro?</span>
            <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--fail)' }} disabled={eliminando} onClick={eliminar}>
              {eliminando ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={eliminando} onClick={() => setConfirmando(false)}>
              Cancelar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function GestionarSuitesModal({ proyectoId, onClose, onCambiado }) {
  const [tree, setTree] = useState(null);
  const [error, setError] = useState(null);

  async function cargar() {
    setError(null);
    try {
      const { data } = await suitesApi.tree(proyectoId);
      setTree(data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId]);

  const filas = tree ? flattenWithDepth(tree) : [];

  async function refrescar() {
    await cargar();
    onCambiado?.();
  }

  return (
    <Modal title="Gestionar suites" onClose={onClose} width={620}>
      {error && <div className="alert alert-error">{error}</div>}
      {tree === null && <div className="center-state">Cargando&hellip;</div>}
      {tree !== null && filas.length === 0 && (
        <div className="center-state">Este proyecto todavía no tiene ninguna suite.</div>
      )}
      {filas.map((suite) => (
        <SuiteRow
          key={suite.id}
          suite={suite}
          filas={filas}
          onGuardado={refrescar}
          onEliminado={refrescar}
        />
      ))}
    </Modal>
  );
}
