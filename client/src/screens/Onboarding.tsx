import { useState, type ReactNode } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useAreas } from '../areas';
import { Icono } from '../icons';
import { pushSoportado, activarPush } from '../push';
import NodoIsotipo from '../brand/NodoIsotipo';

/** Wizard de primer uso. Al terminar (o saltar) marca onboarding_done en settings. */
export default function Onboarding({ onDone }: { onDone: () => void }) {
  const { usuario, setNombre } = useAuth();
  const [areas] = useAreas();
  const [paso, setPaso] = useState(0);
  const [nombre, setN] = useState(usuario?.nombre ?? '');
  const [habito, setHabito] = useState('');
  const [pushMsg, setPushMsg] = useState('');
  const [cerrando, setCerrando] = useState(false);

  async function marcarHecho() {
    await api('/settings', { method: 'PUT', body: { onboarding_done: '1' } }).catch(() => {});
  }

  async function finalizar() {
    setCerrando(true);
    try {
      const nm = nombre.trim();
      if (nm && nm !== usuario?.nombre) {
        await api('/auth/nombre', { method: 'PATCH', body: { nombre: nm } }).catch(() => {});
        setNombre(nm);
      }
      if (habito.trim()) {
        await api('/habitos', { method: 'POST', body: { nombre: habito.trim(), frecuencia: 'diaria' } }).catch(() => {});
      }
      await marcarHecho();
    } finally {
      onDone();
    }
  }

  async function saltar() {
    setCerrando(true);
    await marcarHecho();
    onDone();
  }

  async function activar() {
    setPushMsg('');
    try { await activarPush(); setPushMsg('✓ Recordatorios activados en este dispositivo.'); }
    catch (e) { setPushMsg(e instanceof Error ? e.message : 'No se pudo activar.'); }
  }

  const pasos: { titulo: string; cuerpo: ReactNode }[] = [
    {
      titulo: 'Bienvenido a Nodo Vida',
      cuerpo: (
        <>
          <p className="ob-lead">Tu sistema para ordenar la vida en un solo lugar: dinero, salud, proyectos y crecimiento.
            Registras lo que pasa y Nodo te devuelve el panorama —con Silvia, tu coach, observando tus números.</p>
          <p className="muted">Te tomará menos de un minuto dejarlo listo.</p>
        </>
      ),
    },
    {
      titulo: '¿Cómo te llamamos?',
      cuerpo: (
        <>
          <p className="ob-lead">Para saludarte al abrir la app.</p>
          <input value={nombre} onChange={(e) => setN(e.target.value)} placeholder="Tu nombre" autoFocus />
        </>
      ),
    },
    {
      titulo: 'Tu vida en áreas',
      cuerpo: (
        <>
          <p className="ob-lead">Todo en Nodo cuelga de un área. Cada hábito, tarea u objetivo pertenece a una, para que veas tu vida por dimensión.</p>
          <div className="ob-areas">
            {(areas ?? []).map((a) => (
              <span key={a.id} className="ob-area"><span className="area-dot" style={{ background: a.color }} /> {a.nombre}</span>
            ))}
          </div>
          <p className="muted">Las puedes editar después en Configuración.</p>
        </>
      ),
    },
    {
      titulo: 'Tu primer hábito',
      cuerpo: (
        <>
          <p className="ob-lead">Empecemos con uno diario que quieras sostener. (Opcional — puedes saltarlo.)</p>
          <input value={habito} onChange={(e) => setHabito(e.target.value)} placeholder="Leer, meditar, gym…" />
        </>
      ),
    },
    {
      titulo: 'Recordatorios',
      cuerpo: (
        <>
          <p className="ob-lead">Nodo puede avisarte para pesarte, cumplir hábitos y revisar tus tareas del día.</p>
          {pushSoportado() ? (
            <button className="btn-secondary" onClick={activar}><Icono name="sparkles" size={15} /> Activar recordatorios</button>
          ) : (
            <p className="muted">En iPhone, instala Nodo en la pantalla de inicio para recibir recordatorios.</p>
          )}
          {pushMsg && <p className="row-sub" style={{ marginTop: '0.5rem' }}>{pushMsg}</p>}
        </>
      ),
    },
  ];

  const ultimo = paso === pasos.length - 1;
  const actual = pasos[paso];

  return (
    <div className="ob-overlay">
      <div className="ob-card">
        <div className="ob-brand"><NodoIsotipo size={34} /></div>
        <div className="ob-dots">
          {pasos.map((_, i) => <span key={i} className={`ob-dot ${i === paso ? 'ob-dot--on' : ''}`} />)}
        </div>
        <h2 className="ob-title">{actual.titulo}</h2>
        <div className="ob-body">{actual.cuerpo}</div>
        <div className="ob-foot">
          {paso > 0 ? <button className="btn-ghost" onClick={() => setPaso(paso - 1)} disabled={cerrando}>Atrás</button> : <button className="btn-ghost" onClick={saltar} disabled={cerrando}>Saltar</button>}
          {ultimo
            ? <button className="btn-primary" onClick={finalizar} disabled={cerrando}>Empezar</button>
            : <button className="btn-primary" onClick={() => setPaso(paso + 1)} disabled={cerrando}>Siguiente</button>}
        </div>
      </div>
    </div>
  );
}
