import { useState } from 'react';
import { api, pct } from '../api';
import { Page, useCargar, Segmented, Modal, Field, Vacio, Progress } from '../ui';
import { Icono } from '../icons';

interface Tarea { id: number; titulo: string; area_id: number; proyecto_id: number | null; prioridad: string; fecha_vence: string | null; estado: string }
interface Proyecto { id: number; nombre: string; area_id: number; area_color: string; estado: string; avance: number; tareas_total: number; tareas_hechas: number }
interface Area { id: number; nombre: string; color: string }

type Vista = 'hoy' | 'inbox' | 'todas' | 'proyectos';

export default function Tareas() {
  const [vista, setVista] = useState<Vista>('hoy');
  const [areas] = useCargar<Area[]>(() => api<Area[]>('/areas'));
  const [nuevo, setNuevo] = useState(false);

  return (
    <Page titulo="Tareas" icono="checks" accion={<button className="btn-primary" onClick={() => setNuevo(true)}><Icono name="plus" size={16} /> Tarea</button>}>
      <Segmented value={vista} onChange={setVista} opciones={[
        { v: 'hoy', label: 'Hoy' }, { v: 'inbox', label: 'Inbox' }, { v: 'todas', label: 'Todas' }, { v: 'proyectos', label: 'Proyectos' },
      ]} />
      <div className="section-gap">
        {vista === 'proyectos' ? <Proyectos areas={areas ?? []} /> : <ListaTareas vista={vista} areas={areas ?? []} />}
      </div>
      {nuevo && <NuevaTarea areas={areas ?? []} onClose={() => setNuevo(false)} onSaved={() => setNuevo(false)} />}
    </Page>
  );
}

function ListaTareas({ vista, areas }: { vista: Exclude<Vista, 'proyectos'>; areas: Area[] }) {
  const [tareas, recargar, cargando] = useCargar<Tarea[]>(() => api<Tarea[]>(`/tareas?vista=${vista}`), [vista]);
  const areaColor = (id: number) => areas.find((a) => a.id === id)?.color;

  async function toggle(t: Tarea) {
    await api(`/tareas/${t.id}`, { method: 'PATCH', body: { estado: t.estado === 'hecha' ? 'pendiente' : 'hecha' } });
    recargar();
  }
  async function borrar(t: Tarea) {
    if (!confirm('¿Borrar tarea?')) return;
    await api(`/tareas/${t.id}`, { method: 'DELETE' });
    recargar();
  }

  if (cargando || !tareas) return <p className="muted">Cargando…</p>;
  if (tareas.length === 0) return <Vacio texto={vista === 'hoy' ? 'Nada vence hoy. 🎉' : 'Sin tareas.'} />;
  return (
    <div className="card">
      {tareas.map((t) => (
        <div key={t.id} className="row">
          <button className={`check ${t.estado === 'hecha' ? 'check--on' : ''}`} onClick={() => toggle(t)}><Icono name="checks" size={12} /></button>
          <div className="row-main" style={{ flex: 1 }}>
            <span className="row-title" style={t.estado === 'hecha' ? { textDecoration: 'line-through', color: 'var(--ink-3)' } : undefined}>{t.titulo}</span>
            <span className="row-sub">{t.fecha_vence ?? 'sin fecha'} · {t.prioridad}{areaColor(t.area_id) ? '' : ''}</span>
          </div>
          <span className="area-dot" style={{ background: areaColor(t.area_id) ?? 'var(--border)' }} />
          <button className="icon-btn" onClick={() => borrar(t)}><Icono name="trash" size={15} /></button>
        </div>
      ))}
    </div>
  );
}

function Proyectos({ areas }: { areas: Area[] }) {
  const [proyectos, recargar, cargando] = useCargar<Proyecto[]>(() => api<Proyecto[]>('/tareas/proyectos'));
  const [nuevo, setNuevo] = useState(false);
  return (
    <>
      <div className="btn-row" style={{ marginBottom: '0.75rem' }}>
        <button className="btn-ghost" onClick={() => setNuevo(true)}><Icono name="plus" size={14} /> Proyecto</button>
      </div>
      {cargando || !proyectos ? <p className="muted">Cargando…</p> : proyectos.length === 0 ? <Vacio texto="Sin proyectos." /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {proyectos.map((p) => (
            <div key={p.id} className="card">
              <div className="row" style={{ borderBottom: 'none', paddingBottom: '0.3rem' }}>
                <div className="area-chip"><span className="area-dot" style={{ background: p.area_color }} /> <strong>{p.nombre}</strong></div>
                <span className="row-sub">{p.tareas_hechas}/{p.tareas_total} · {pct(p.avance)} · {p.estado}</span>
              </div>
              <Progress value={p.avance} color={p.area_color} />
            </div>
          ))}
        </div>
      )}
      {nuevo && <NuevoProyecto areas={areas} onClose={() => setNuevo(false)} onSaved={() => { setNuevo(false); recargar(); }} />}
    </>
  );
}

function NuevaTarea({ areas, onClose, onSaved }: { areas: Area[]; onClose: () => void; onSaved: () => void }) {
  const [titulo, setTitulo] = useState('');
  const [area, setArea] = useState<number | ''>(areas[0]?.id ?? '');
  const [prioridad, setPrioridad] = useState('media');
  const [fecha, setFecha] = useState('');
  const [proyectos] = useCargar<Proyecto[]>(() => api<Proyecto[]>('/tareas/proyectos'));
  const [proyecto, setProyecto] = useState<number | ''>('');
  const [error, setError] = useState('');

  async function guardar() {
    setError('');
    try {
      await api('/tareas', { method: 'POST', body: { titulo, area_id: area, prioridad, fecha_vence: fecha || null, proyecto_id: proyecto || null } });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  }

  return (
    <Modal titulo="Nueva tarea" onClose={onClose}>
      <Field label="Título"><input value={titulo} onChange={(e) => setTitulo(e.target.value)} /></Field>
      <Field label="Área"><select value={area} onChange={(e) => setArea(Number(e.target.value))}>{areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></Field>
      <Field label="Proyecto (opcional)"><select value={proyecto} onChange={(e) => setProyecto(e.target.value ? Number(e.target.value) : '')}><option value="">— pendiente general —</option>{(proyectos ?? []).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Field>
      <Field label="Prioridad"><select value={prioridad} onChange={(e) => setPrioridad(e.target.value)}><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option></select></Field>
      <Field label="Vence (opcional)"><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
      {error && <p className="error-msg">{error}</p>}
      <button className="btn-primary" onClick={guardar} disabled={!titulo || !area}>Guardar</button>
    </Modal>
  );
}

function NuevoProyecto({ areas, onClose, onSaved }: { areas: Area[]; onClose: () => void; onSaved: () => void }) {
  const [nombre, setNombre] = useState('');
  const [area, setArea] = useState<number | ''>(areas[0]?.id ?? '');
  const [error, setError] = useState('');
  async function guardar() {
    setError('');
    try {
      await api('/tareas/proyectos', { method: 'POST', body: { nombre, area_id: area } });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  }
  return (
    <Modal titulo="Nuevo proyecto" onClose={onClose}>
      <Field label="Nombre"><input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ibérico, otro negocio…" /></Field>
      <Field label="Área"><select value={area} onChange={(e) => setArea(Number(e.target.value))}>{areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></Field>
      {error && <p className="error-msg">{error}</p>}
      <button className="btn-primary" onClick={guardar} disabled={!nombre || !area}>Guardar</button>
    </Modal>
  );
}
