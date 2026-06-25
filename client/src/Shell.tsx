import { type ReactNode, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { useTema } from './theme';
import { Icono } from './icons';
import { useOffline } from './offline';
import NodoIsotipo from './brand/NodoIsotipo';

interface Item {
  ruta: string;
  label: string;
  icono: Parameters<typeof Icono>[0]['name'];
}

const ITEMS: Item[] = [
  { ruta: '/', label: 'Inicio', icono: 'home' },
  { ruta: '/finanzas', label: 'Dinero', icono: 'wallet' },
  { ruta: '/inversiones', label: 'Inversiones', icono: 'trending' },
  { ruta: '/patrimonio', label: 'Patrimonio', icono: 'growth' },
  { ruta: '/salud', label: 'Salud', icono: 'heart' },
  { ruta: '/habitos', label: 'Hábitos', icono: 'repeat' },
  { ruta: '/tareas', label: 'Tareas', icono: 'checks' },
  { ruta: '/objetivos', label: 'Objetivos', icono: 'target' },
  { ruta: '/configuracion', label: 'Configuración', icono: 'settings' },
];

// Solo algunos en la barra inferior móvil (las más usadas).
const BOTTOM = ['/', '/finanzas', '/habitos', '/tareas'];

export default function Shell({ children }: { children: ReactNode }) {
  const { usuario, logout } = useAuth();
  const { tema, alternar } = useTema();
  const { online, pendientes, sincronizar } = useOffline();
  const [masOpen, setMasOpen] = useState(false);
  const { pathname } = useLocation();

  const syncChip = !online ? (
    <span className="ctx-chip ctx-chip--off">
      <span className="dot-status" /> Sin conexión
      {pendientes > 0 && <span>· {pendientes}</span>}
    </span>
  ) : pendientes > 0 ? (
    <span className="ctx-chip ctx-chip--sync" onClick={() => void sincronizar()}>
      <span className="dot-status" /> Sincronizando {pendientes}
    </span>
  ) : (
    <span className="ctx-chip">
      <span className="dot-status" /> En línea
    </span>
  );

  const bottomItems = ITEMS.filter((i) => BOTTOM.includes(i.ruta));
  // Secciones que no caben en la barra inferior: van en el panel "Más".
  const masItems = ITEMS.filter((i) => !BOTTOM.includes(i.ruta));
  const masActivo = masItems.some((i) => i.ruta === pathname);

  return (
    <div className="shell">
      <aside className="nav-rail">
        <div className="nav-brand">
          <NodoIsotipo size={30} />
          <span className="nav-wordmark">NODO VIDA</span>
        </div>
        <nav className="nav-links">
          {ITEMS.map((i) => (
            <NavLink
              key={i.ruta}
              to={i.ruta}
              end={i.ruta === '/'}
              className={({ isActive }) => (isActive ? 'nav-link nav-link--on' : 'nav-link')}
            >
              <Icono name={i.icono} size={20} />
              <span>{i.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="nav-foot">
          <button className="nav-link" onClick={alternar}>
            <Icono name={tema === 'dark' ? 'sun' : 'moon'} size={20} />
            <span>{tema === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
          </button>
          <button className="nav-link" onClick={logout}>
            <Icono name="logout" size={20} />
            <span>Salir</span>
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="context-bar">
          <div className="ctx-left">
            <span className="ctx-negocio">Nodo Vida</span>
            {usuario && <span className="ctx-user">{usuario.nombre}</span>}
          </div>
          <div className="ctx-right">
            {syncChip}
            <button className="icon-btn" onClick={alternar} aria-label="Cambiar tema" title="Cambiar tema">
              <Icono name={tema === 'dark' ? 'sun' : 'moon'} size={18} />
            </button>
          </div>
        </header>

        <main className="content">{children}</main>
      </div>

      {masOpen && (
        <div className="more-overlay" onClick={() => setMasOpen(false)}>
          <div className="more-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="more-sheet-handle" />
            <div className="more-grid">
              {masItems.map((i) => (
                <NavLink
                  key={i.ruta}
                  to={i.ruta}
                  end={i.ruta === '/'}
                  onClick={() => setMasOpen(false)}
                  className={({ isActive }) => (isActive ? 'more-link more-link--on' : 'more-link')}
                >
                  <Icono name={i.icono} size={22} />
                  <span>{i.label}</span>
                </NavLink>
              ))}
            </div>
            <div className="more-foot">
              <button className="more-link" onClick={() => { alternar(); }}>
                <Icono name={tema === 'dark' ? 'sun' : 'moon'} size={22} />
                <span>{tema === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
              </button>
              <button className="more-link" onClick={logout}>
                <Icono name="logout" size={22} />
                <span>Salir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="bottom-nav">
        {bottomItems.map((i) => (
          <NavLink
            key={i.ruta}
            to={i.ruta}
            end={i.ruta === '/'}
            onClick={() => setMasOpen(false)}
            className={({ isActive }) => (isActive ? 'bottom-link bottom-link--on' : 'bottom-link')}
          >
            <Icono name={i.icono} size={22} />
            <span>{i.label}</span>
          </NavLink>
        ))}
        <button
          className={`bottom-link ${masActivo || masOpen ? 'bottom-link--on' : ''}`}
          onClick={() => setMasOpen((v) => !v)}
          aria-label="Más secciones"
        >
          <Icono name="menu" size={22} />
          <span>Más</span>
        </button>
      </nav>
    </div>
  );
}
