import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from './api';
import { AuthProvider, useAuth } from './auth';
import Login from './screens/Login';
import Onboarding from './screens/Onboarding';
import Home from './screens/Home';
import Finanzas from './screens/Finanzas';
import Inversiones from './screens/Inversiones';
import Patrimonio from './screens/Patrimonio';
import Salud from './screens/Salud';
import Habitos from './screens/Habitos';
import Tareas from './screens/Tareas';
import Objetivos from './screens/Objetivos';
import Revisiones from './screens/Revisiones';
import Configuracion from './screens/Configuracion';
import OfflineBanner from './OfflineBanner';
import SilviaBubble from './silvia/SilviaBubble';
import Shell from './Shell';
import SplashIntro from './brand/SplashIntro';

function AppBody() {
  const { usuario, cargando } = useAuth();
  // null = aún no sabemos; true/false = mostrar o no el onboarding.
  const [onboarding, setOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    if (!usuario) { setOnboarding(null); return; }
    api<Record<string, string>>('/settings')
      .then((s) => setOnboarding(s.onboarding_done !== '1'))
      .catch(() => setOnboarding(false)); // ante un error, no atrapamos al usuario.
  }, [usuario]);

  if (cargando) {
    return (
      <div className="app-shell">
        <p className="muted">Cargando…</p>
      </div>
    );
  }
  if (!usuario) return <Login />;
  if (onboarding) return <Onboarding onDone={() => setOnboarding(false)} />;

  return (
    <Shell>
      <OfflineBanner />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/finanzas" element={<Finanzas />} />
        <Route path="/inversiones" element={<Inversiones />} />
        <Route path="/patrimonio" element={<Patrimonio />} />
        <Route path="/salud" element={<Salud />} />
        <Route path="/habitos" element={<Habitos />} />
        <Route path="/tareas" element={<Tareas />} />
        <Route path="/objetivos" element={<Objetivos />} />
        <Route path="/revisiones" element={<Revisiones />} />
        <Route path="/configuracion" element={<Configuracion />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <SilviaBubble />
    </Shell>
  );
}

export default function App() {
  const [splash, setSplash] = useState(() => !sessionStorage.getItem('nodo-splash'));
  return (
    <>
      {splash && (
        <SplashIntro
          onDone={() => {
            sessionStorage.setItem('nodo-splash', '1');
            setSplash(false);
          }}
        />
      )}
      <AuthProvider>
        <BrowserRouter>
          <AppBody />
        </BrowserRouter>
      </AuthProvider>
    </>
  );
}
