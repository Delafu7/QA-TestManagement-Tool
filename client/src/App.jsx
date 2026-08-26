import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { UsuarioProvider, useUsuario } from './context/UsuarioContext';
import { ProyectoProvider } from './context/ProyectoContext';
import AppShell from './components/AppShell';
import SeleccionUsuario from './screens/SeleccionUsuario';
import Dashboard from './screens/Dashboard/Dashboard';
import CasosListado from './screens/CasosPrueba/CasosListado';
import FasesTesting from './screens/FasesTesting/FasesTesting';
import Resultados from './screens/Resultados/Resultados';
import EjecucionCiclo from './screens/EjecucionCiclo/EjecucionCiclo';
import Terminal from './screens/Terminal/Terminal';

function AppRoutes() {
  const { usuario, cargando } = useUsuario();

  if (cargando) return <div className="center-state" style={{ minHeight: '100vh' }}>Cargando&hellip;</div>;
  if (!usuario) return <SeleccionUsuario />;

  return (
    <ProyectoProvider>
      <Routes>
        <Route path="/ejecucion/:cicloId" element={<EjecucionCiclo />} />
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/casos" element={<CasosListado />} />
          <Route path="/fases" element={<FasesTesting />} />
          <Route path="/resultados" element={<Resultados />} />
          <Route path="/resultados/:cicloId" element={<Resultados />} />
          <Route path="/terminal" element={<Terminal />} />
        </Route>
      </Routes>
    </ProyectoProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <UsuarioProvider>
        <AppRoutes />
      </UsuarioProvider>
    </BrowserRouter>
  );
}
