import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProyectoProvider } from './context/ProyectoContext';
import AppShell from './components/AppShell';
import Dashboard from './screens/Dashboard/Dashboard';
import CasosListado from './screens/CasosPrueba/CasosListado';
import FasesTesting from './screens/FasesTesting/FasesTesting';
import Resultados from './screens/Resultados/Resultados';
import EjecucionCiclo from './screens/EjecucionCiclo/EjecucionCiclo';
import Terminal from './screens/Terminal/Terminal';

function AppRoutes() {
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
      <AppRoutes />
    </BrowserRouter>
  );
}
