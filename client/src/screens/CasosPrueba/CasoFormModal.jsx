import { useState } from 'react';
import Modal from '../../components/Modal';
import { casosApi } from '../../api/casosApi';
import { useUsuario } from '../../context/UsuarioContext';
import { IconPlus, IconClose } from '../../components/icons';

const PASO_VACIO = () => ({ accion: '', resultadoEsperado: '' });

export default function CasoFormModal({ suites, onClose, onCreado }) {
  const { usuario } = useUsuario();
  const [suiteId, setSuiteId] = useState(suites[0]?.id || '');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precondiciones, setPrecondiciones] = useState('');
  const [prioridad, setPrioridad] = useState('media');
  const [tipo, setTipo] = useState('funcional');
  const [pasos, setPasos] = useState([PASO_VACIO()]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  function actualizarPaso(i, campo, valor) {
    setPasos((prev) => prev.map((p, idx) => (idx === i ? { ...p, [campo]: valor } : p)));
  }
  function agregarPaso() {
    setPasos((prev) => [...prev, PASO_VACIO()]);
  }
  function quitarPaso(i) {
    setPasos((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const nuevo = await casosApi.create(suiteId, {
        titulo,
        descripcion,
        precondiciones,
        prioridad,
        tipo,
        autorId: usuario.id,
        pasos: pasos.map((p, i) => ({ orden: i + 1, accion: p.accion, resultadoEsperado: p.resultadoEsperado })),
      });
      onCreado(nuevo);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal title="Nuevo caso de prueba" onClose={onClose} width={560}>
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="c-suite">Suite</label>
          <select id="c-suite" value={suiteId} onChange={(e) => setSuiteId(e.target.value)} required>
            {suites.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="c-titulo">Título</label>
          <input id="c-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="c-desc">Descripción</label>
          <textarea id="c-desc" rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="c-pre">Precondiciones</label>
          <textarea id="c-pre" rows={2} value={precondiciones} onChange={(e) => setPrecondiciones(e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label htmlFor="c-prio">Prioridad</label>
            <select id="c-prio" value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="c-tipo">Tipo</label>
            <select id="c-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="funcional">Funcional</option>
              <option value="regresion">Regresión</option>
              <option value="humo">Humo</option>
              <option value="exploratorio">Exploratorio</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label>Pasos</label>
          {pasos.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
              <div style={{ width: 22, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, color: 'var(--text-2)', flex: '0 0 auto' }}>{i + 1}</div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input placeholder="Acción" value={p.accion} onChange={(e) => actualizarPaso(i, 'accion', e.target.value)} required
                  style={{ padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }} />
                <input placeholder="Resultado esperado" value={p.resultadoEsperado} onChange={(e) => actualizarPaso(i, 'resultadoEsperado', e.target.value)} required
                  style={{ padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }} />
              </div>
              {pasos.length > 1 && (
                <button type="button" className="icon-btn" onClick={() => quitarPaso(i)} aria-label="Quitar paso" style={{ marginTop: 6 }}>
                  <IconClose size={14} />
                </button>
              )}
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={agregarPaso}>
            <IconPlus size={12} />
            Añadir paso
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-2)' }}>
          <button type="button" className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={guardando || !suiteId}>
            {guardando ? 'Creando…' : 'Crear caso'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
