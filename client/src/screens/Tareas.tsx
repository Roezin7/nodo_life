import { useState } from 'react';
import { api, pct } from '../api';
import { Page, useCargar, Modal, Field, Progress } from '../ui';
import { Icono } from '../icons';

interface Tarea { id: number; titulo: string; area_id: number; proyecto_id: number | null; prioridad: string; fecha_vence: string | null; estado: string }
interface ProyCol { id: number; nombre: string; area_id: number; area_nombre: string; area_color: string; estado: string; tareas_total: number; tareas_hechas: number; avance: number; tareas: Tarea[] }
interface Tablero { hoy: Tarea[]; proximos: Tarea[]; algun_dia: Tarea[]; proyectos: ProyCol[] }
interface Area { id: number; nombre: string; color: string }

const hoyISO = () => new Date().toISOString().slice(0, 10);
const masDias = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

export default function Tareas() {
  const [tab, recargar, cargando] = useCargar<Tablero>(() => api<Tablero>('/tareas/tablero'));
  const [areas] = useCargar<Area[]>(() => api<Area[]>('/areas'));
  const [nuevaTarea, setNuevaTarea] = useState(false);
  const [nuevoProy, setNuevoProy] = useState(false);
  const [editTarea, setEditTarea] = useState<Tarea | null>(null);
  const [editProy, setEditProy] = useState<ProyCol | null>(null);
  const areaDefault = areas?.[0]?.id;

  async function toggle(t: Tarea) {
    await api(`/tareas/${t.id}`, { method: 'PATCH', body: { estado: t.estado === 'hecha' ? 'pendiente' : 'hecha' } });
    recargar();
  }
  async function borrar(t: Tarea) {
    if (!confirm('¿Borrar tarea?')) return;
    await api(`/tareas/${t.id}`, { method: 'DELETE' });
    recargar();
  }
  async function crear(titulo: string, extra: Partial<Tarea>) {
    if (areaDefault == null && extra.area_id == null) return;
    await api('/tareas', { method: 'POST', body: { titulo, area_id: extra.area_id ?? areaDefault, fecha_vence: extra.fecha_vence ?? null, proyecto_id: extra.proyecto_id ?? null } });
    recargar();
  }
  async function borrarProy(p: ProyCol) {
    if (!confirm(`¿Borrar el proyecto "${p.nombre}"? Sus tareas quedarán sin proyecto.`)) return;
    await api(`/tareas/proyectos/${p.id}`, { method: 'DELETE' });
    recargar();
  }

  const accion = (
    <div className="btn-row">
      <button className="btn-ghost" onClick={() => setNuevoProy(true)}><Icono name="plus" size={14} /> Proyecto</button>
      <button className="btn-primary" onClick={() => setNuevaTarea(true)}><Icono name="plus" size={16} /> Tarea</button>
    </div>
  );

  return (
    <Page titulo="Tareas" icono="checks" accion={accion}>
      {cargando || !tab ? <p className="muted">Cargando…</p> : (
        <div className="board">
          <Columna titulo="Hoy" tareas={tab.hoy} onToggle={toggle} onBorrar={borrar} onEditar={setEditTarea}
            onCrear={(t) => crear(t, { fecha_vence: hoyISO() })} />
          <Columna titulo="Próximos días" tareas={tab.proximos} onToggle={toggle} onBorrar={borrar} onEditar={setEditTarea}
            onCrear={(t) => crear(t, { fecha_vence: masDias(1) })} verFecha />
          <Columna titulo="Algún día" tareas={tab.algun_dia} onToggle={toggle} onBorrar={borrar} onEditar={setEditTarea}
            onCrear={(t) => crear(t, {})} />
          {tab.proyectos.map((p) => (
            <Columna key={p.id} titulo={p.nombre} color={p.area_color} tareas={p.tareas}
              sub={<><span>{p.tareas_hechas}/{p.tareas_total} · {pct(p.avance)}</span><Progress value={p.avance} color={p.area_color} /></>}
              acciones={<>
                <button className="icon-btn" onClick={() => setEditProy(p)} aria-label="Editar proyecto"><Icono name="edit" size={14} /></button>
                <button className="icon-btn" onClick={() => borrarProy(p)} aria-label="Borrar proyecto"><Icono name="trash" size={14} /></button>
              </>}
              onToggle={toggle} onBorrar={borrar} onEditar={setEditTarea}
              onCrear={(t) => crear(t, { proyecto_id: p.id, area_id: p.area_id })} verFecha />
          ))}
        </div>
      )}
      {nuevaTarea && <TareaForm areas={areas ?? []} proyectos={tab?.proyectos ?? []} onClose={() => setNuevaTarea(false)} onSaved={() => { setNuevaTarea(false); recargar(); }} />}
      {editTarea && <TareaForm areas={areas ?? []} proyectos={tab?.proyectos ?? []} tarea={editTarea} onClose={() => setEditTarea(null)} onSaved={() => { setEditTarea(null); recargar(); }} />}
      {nuevoProy && <ProyectoForm areas={areas ?? []} onClose={() => setNuevoProy(false)} onSaved={() => { setNuevoProy(false); recargar(); }} />}
      {editProy && <ProyectoForm areas={areas ?? []} proyecto={editProy} onClose={() => setEditProy(null)} onSaved={() => { setEditProy(null); recargar(); }} />}
    </Page>
  );
}

function Columna({ titulo, color, sub, acciones, tareas, onToggle, onBorrar, onEditar, onCrear, verFecha }: {
  titulo: string; color?: string; sub?: React.ReactNode; acciones?: React.ReactNode; tareas: Tarea[]; verFecha?: boolean;
  onToggle: (t: Tarea) => void; onBorrar: (t: Tarea) => void; onEditar: (t: Tarea) => void; onCrear: (titulo: string) => void;
}) {
  const [texto, setTexto] = useState('');
  function add() { const t = texto.trim(); if (!t) return; onCrear(t); setTexto(''); }
  return (
    <div className="board-col">
      <div className="board-col-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="board-col-title">
            {color && <span className="area-dot" style={{ background: color }} />}
            <strong>{titulo}</strong>
            <span className="board-count">{tareas.length}</span>
          </div>
          {sub && <div className="board-col-sub">{sub}</div>}
        </div>
        {acciones}
      </div>
      <div className="board-col-body">
        {tareas.length === 0 ? <p className="board-empty">Sin pendientes</p> : tareas.map((t) => (
          <div key={t.id} className="board-card">
            <button className={`check ${t.estado === 'hecha' ? 'check--on' : ''}`} onClick={() => onToggle(t)} aria-label="Completar"><Icono name="checks" size={11} /></button>
            <span className="board-card-title" onClick={() => onEditar(t)}>
              {t.prioridad === 'alta' && <span className="prio-alta" title="Prioridad alta">●</span>}
              {t.titulo}
              {verFecha && t.fecha_vence && <span className="board-card-fecha">{t.fecha_vence.slice(5)}</span>}
            </span>
            <button className="icon-btn" onClick={() => onBorrar(t)} aria-label="Borrar"><Icono name="trash" size={13} /></button>
          </div>
        ))}
      </div>
      <input className="board-add" value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} placeholder="+ Agregar" />
    </div>
  );
}

function TareaForm({ areas, proyectos, tarea, onClose, onSaved }: { areas: Area[]; proyectos: ProyCol[]; tarea?: Tarea; onClose: () => void; onSaved: () => void }) {
  const [titulo, setTitulo] = useState(tarea?.titulo ?? '');
  const [area, setArea] = useState<number | ''>(tarea?.area_id ?? areas[0]?.id ?? '');
  const [prioridad, setPrioridad] = useState(tarea?.prioridad ?? 'media');
  const [fecha, setFecha] = useState(tarea?.fecha_vence ?? '');
  const [proyecto, setProyecto] = useState<number | ''>(tarea?.proyecto_id ?? '');
  const [error, setError] = useState('');

  async function guardar() {
    setError('');
    try {
      const body = { titulo, area_id: area, prioridad, fecha_vence: fecha || null, proyecto_id: proyecto || null };
      if (tarea) await api(`/tareas/${tarea.id}`, { method: 'PATCH', body });
      else await api('/tareas', { method: 'POST', body });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  }

  return (
    <Modal titulo={tarea ? 'Editar tarea' : 'Nueva tarea'} onClose={onClose}>
      <Field label="Título"><input value={titulo} onChange={(e) => setTitulo(e.target.value)} /></Field>
      <Field label="Área"><select value={area} onChange={(e) => setArea(Number(e.target.value))}>{areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></Field>
      <Field label="Proyecto (opcional)"><select value={proyecto} onChange={(e) => setProyecto(e.target.value ? Number(e.target.value) : '')}><option value="">— pendiente general —</option>{proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Field>
      <Field label="Prioridad"><select value={prioridad} onChange={(e) => setPrioridad(e.target.value)}><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option></select></Field>
      <Field label="Vence (opcional)"><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
      {error && <p className="error-msg">{error}</p>}
      <button className="btn-primary" onClick={guardar} disabled={!titulo || !area}>Guardar</button>
    </Modal>
  );
}

function ProyectoForm({ areas, proyecto, onClose, onSaved }: { areas: Area[]; proyecto?: ProyCol; onClose: () => void; onSaved: () => void }) {
  const [nombre, setNombre] = useState(proyecto?.nombre ?? '');
  const [area, setArea] = useState<number | ''>(proyecto?.area_id ?? areas[0]?.id ?? '');
  const [estado, setEstado] = useState(proyecto?.estado ?? 'activo');
  const [error, setError] = useState('');
  async function guardar() {
    setError('');
    try {
      const body = { nombre, area_id: area, estado };
      if (proyecto) await api(`/tareas/proyectos/${proyecto.id}`, { method: 'PATCH', body });
      else await api('/tareas/proyectos', { method: 'POST', body: { nombre, area_id: area } });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  }
  return (
    <Modal titulo={proyecto ? 'Editar proyecto' : 'Nuevo proyecto'} onClose={onClose}>
      <Field label="Nombre"><input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ibérico, otro negocio…" /></Field>
      <Field label="Área"><select value={area} onChange={(e) => setArea(Number(e.target.value))}>{areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></Field>
      {proyecto && <Field label="Estado"><select value={estado} onChange={(e) => setEstado(e.target.value)}><option value="activo">Activo</option><option value="pausado">Pausado</option><option value="hecho">Hecho</option></select></Field>}
      {error && <p className="error-msg">{error}</p>}
      <button className="btn-primary" onClick={guardar} disabled={!nombre || !area}>Guardar</button>
    </Modal>
  );
}
