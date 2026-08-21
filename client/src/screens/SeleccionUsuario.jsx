import { useEffect, useState } from 'react';
import { usuariosApi } from '../api/usuariosApi';
import { useUsuario } from '../context/UsuarioContext';

function initials(nombre) {
  return nombre.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

export default function SeleccionUsuario() {
  const { seleccionarUsuario } = useUsuario();
  const [usuarios, setUsuarios] = useState(null);
  const [error, setError] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState('qa');
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    usuariosApi
      .list()
      .then((r) => setUsuarios(r.data))
      .catch((e) => setError(e.message));
  }, []);

  async function crearUsuario(e) {
    e.preventDefault();
    setCreando(true);
    setError(null);
    try {
      const nuevo = await usuariosApi.create({ nombre, email, rol });
      seleccionarUsuario(nuevo);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreando(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-alt)', padding: 'var(--space-4)' }}>
      <div className="card" style={{ padding: 'var(--space-6)', width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-6)' }}>
          <svg width="30" height="30" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="7" fill="var(--primary)" />
            <path d="M8 14.5l4 4 8-9" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>QA Tool</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>¿Quién eres?</div>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {!mostrarForm && (
          <>
            {usuarios === null && <div className="center-state">Cargando usuarios&hellip;</div>}
            {usuarios?.length === 0 && (
              <div className="center-state" style={{ padding: 'var(--space-4) 0' }}>
                Todavía no hay ningún usuario. Crea el primero para empezar.
              </div>
            )}
            {usuarios?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 'var(--space-4)' }}>
                {usuarios.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => seleccionarUsuario(u)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                      borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                      background: 'var(--bg-elevated)', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <div className="avatar">{initials(u.nombre)}</div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{u.nombre}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-2)', textTransform: 'capitalize' }}>{u.rol}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setMostrarForm(true)}>
              + Crear usuario
            </button>
          </>
        )}

        {mostrarForm && (
          <form onSubmit={crearUsuario}>
            <div className="field">
              <label htmlFor="nombre">Nombre</label>
              <input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="rol">Rol</label>
              <select id="rol" value={rol} onChange={(e) => setRol(e.target.value)}>
                <option value="qa">QA</option>
                <option value="gestor">Gestor</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setMostrarForm(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={creando}>
                {creando ? 'Creando…' : 'Crear'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
