import { useState } from 'react';
import { api, pct } from '../api';
import { Page, useCargar, Modal, Field, Progress } from '../ui';
import { Icono } from '../icons';
import { useAreas, FiltroArea } from '../areas';

interface Tarea { id: number; titulo: string; area_id: number; proyecto_id: number | null; prioridad: string; fecha_vence: string | null; estado: string }
interface ProyCol { id: number; nombre: string; area_id: number; area_color: string; estado: string; tareas_total: number; tareas_hechas: number; avance: number; tareas: Tarea[] }
interface DiaCol { fecha: string; tareas: Tarea[] }
interface Tablero { dias: DiaCol[]; sin_fecha: Tarea[]; proyectos: ProyCol[] }

const hoyISO = () => new Date().toISOString().slice(0, 10);
const masDias = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

/** Etiqueta amigable para una fecha ISO: Hoy / Mañana / Ayer / "lun 30 jun". */
function etiquetaDia(iso: string): string {
  if (iso === hoyISO()) return 'Hoy';
  if (iso === masDias(1)) return 'Mañana';
  if (iso === masDias(-1)) return 'Ayer';
  const d = new Date(`${iso}T12:00:00`);
  const s = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function Tareas() {
  const [tab, recargar, cargando] = useCargar<Tablero>(() => api<Tablero>('/tareas/tablero'));
  const [areas] = useAreas();
  const [area, setArea] = useState<number | null>(null);
  const [nuevaTarea, setNuevaTarea] = useState(false);
  const [nuevoProy, setNuevoProy] = useState(false);
  const [editTarea, setEditTarea] = useState<Tarea | null>(null);
  const [editProy, setEditProy] = useState<ProyCol | null>(null);

  const colorArea = (id: number) => areas?.find((a) => a.id === id)?.color ?? 'transparent';
  const filtrar = (ts: Tarea[]) => (area == null ? ts : ts.filter((t) => t.area_id === area));

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
    await api('/tareas', { method: 'POST', body: { titulo, fecha_vence: extra.fecha_vence ?? hoyISO(), proyecto_id: extra.proyecto_id ?? null, area_id: area ?? undefined } });
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

  // Notas por día: siempre mostramos "Hoy" como punto de captura, más cada día con tareas.
  const diasMap = new Map<string, Tarea[]>();
  for (const d of tab?.dias ?? []) diasMap.set(d.fecha, d.tareas);
  if (!diasMap.has(hoyISO())) diasMap.set(hoyISO(), []);
  const dias = [...diasMap.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));

  const proyectosVis = (tab?.proyectos ?? []).filter((p) => area == null || p.area_id === area);

  return (
    <Page titulo="Tareas" icono="checks" accion={accion}>
      {areas && <FiltroArea areas={areas} value={area} onChange={setArea} />}
      {cargando || !tab ? <p className="muted">Cargando…</p> : (
        <div className="board">
          {dias.map(([fecha, tareas]) => (
            <Columna key={fecha} titulo={etiquetaDia(fecha)} vencido={fecha < hoyISO()} tareas={filtrar(tareas)} colorArea={colorArea}
              onToggle={toggle} onBorrar={borrar} onEditar={setEditTarea} onCrear={(t) => crear(t, { fecha_vence: fecha })} />
          ))}
          {filtrar(tab.sin_fecha).length > 0 && (
            <Columna titulo="Sin fecha" tareas={filtrar(tab.sin_fecha)} colorArea={colorArea} onToggle={toggle} onBorrar={borrar} onEditar={setEditTarea}
              onCrear={(t) => crear(t, {})} />
          )}
          {proyectosVis.map((p) => (
            <Columna key={`p${p.id}`} titulo={p.nombre} tareas={p.tareas} colorArea={colorArea}
              sub={<><span>{p.tareas_hechas}/{p.tareas_total} · {pct(p.avance)}</span><Progress value={p.avance} color={p.area_color} /></>}
              acciones={<>
                <button className="icon-btn" onClick={() => setEditProy(p)} aria-label="Editar proyecto"><Icono name="edit" size={14} /></button>
                <button className="icon-btn" onClick={() => borrarProy(p)} aria-label="Borrar proyecto"><Icono name="trash" size={14} /></button>
              </>}
              onToggle={toggle} onBorrar={borrar} onEditar={setEditTarea}
              onCrear={(t) => crear(t, { proyecto_id: p.id })} verFecha />
          ))}
        </div>
      )}
      {nuevaTarea && <TareaForm proyectos={tab?.proyectos ?? []} onClose={() => setNuevaTarea(false)} onSaved={() => { setNuevaTarea(false); recargar(); }} />}
      {editTarea && <TareaForm proyectos={tab?.proyectos ?? []} tarea={editTarea} onClose={() => setEditTarea(null)} onSaved={() => { setEditTarea(null); recargar(); }} />}
      {nuevoProy && <ProyectoForm onClose={() => setNuevoProy(false)} onSaved={() => { setNuevoProy(false); recargar(); }} />}
      {editProy && <ProyectoForm proyecto={editProy} onClose={() => setEditProy(null)} onSaved={() => { setEditProy(null); recargar(); }} />}
    </Page>
  );
}

function Columna({ titulo, vencido, sub, acciones, tareas, onToggle, onBorrar, onEditar, onCrear, verFecha, colorArea }: {
  titulo: string; vencido?: boolean; sub?: React.ReactNode; acciones?: React.ReactNode; tareas: Tarea[]; verFecha?: boolean;
  colorArea?: (id: number) => string;
  onToggle: (t: Tarea) => void; onBorrar: (t: Tarea) => void; onEditar: (t: Tarea) => void; onCrear: (titulo: string) => void;
}) {
  const [texto, setTexto] = useState('');
  function add() { const t = texto.trim(); if (!t) return; onCrear(t); setTexto(''); }
  return (
    <div className="board-col">
      <div className="board-col-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="board-col-title">
            <strong>{titulo}</strong>
            {vencido && <span className="prio-alta" title="Atrasado">●</span>}
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
              {colorArea && <span className="area-dot" style={{ background: colorArea(t.area_id), marginRight: 2 }} />}
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

function TareaForm({ proyectos, tarea, onClose, onSaved }: { proyectos: ProyCol[]; tarea?: Tarea; onClose: () => void; onSaved: () => void }) {
  const [titulo, setTitulo] = useState(tarea?.titulo ?? '');
  const [prioridad, setPrioridad] = useState(tarea?.prioridad ?? 'media');
  const [fecha, setFecha] = useState(tarea?.fecha_vence ?? hoyISO());
  const [proyecto, setProyecto] = useState<number | ''>(tarea?.proyecto_id ?? '');
  const [error, setError] = useState('');

  async function guardar() {
    setError('');
    try {
      const body = { titulo, prioridad, fecha_vence: fecha, proyecto_id: proyecto || null };
      if (tarea) await api(`/tareas/${tarea.id}`, { method: 'PATCH', body });
      else await api('/tareas', { method: 'POST', body });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  }

  return (
    <Modal titulo={tarea ? 'Editar tarea' : 'Nueva tarea'} onClose={onClose}>
      <Field label="Título"><input value={titulo} onChange={(e) => setTitulo(e.target.value)} /></Field>
      <Field label="Día"><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
      <Field label="Proyecto (opcional)"><select value={proyecto} onChange={(e) => setProyecto(e.target.value ? Number(e.target.value) : '')}><option value="">— pendiente general —</option>{proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Field>
      <Field label="Prioridad"><select value={prioridad} onChange={(e) => setPrioridad(e.target.value)}><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option></select></Field>
      {error && <p className="error-msg">{error}</p>}
      <button className="btn-primary" onClick={guardar} disabled={!titulo || !fecha}>Guardar</button>
    </Modal>
  );
}

function ProyectoForm({ proyecto, onClose, onSaved }: { proyecto?: ProyCol; onClose: () => void; onSaved: () => void }) {
  const [nombre, setNombre] = useState(proyecto?.nombre ?? '');
  const [estado, setEstado] = useState(proyecto?.estado ?? 'activo');
  const [error, setError] = useState('');
  async function guardar() {
    setError('');
    try {
      if (proyecto) await api(`/tareas/proyectos/${proyecto.id}`, { method: 'PATCH', body: { nombre, estado } });
      else await api('/tareas/proyectos', { method: 'POST', body: { nombre } });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  }
  return (
    <Modal titulo={proyecto ? 'Editar proyecto' : 'Nuevo proyecto'} onClose={onClose}>
      <Field label="Nombre"><input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ibérico, otro negocio…" /></Field>
      {proyecto && <Field label="Estado"><select value={estado} onChange={(e) => setEstado(e.target.value)}><option value="activo">Activo</option><option value="pausado">Pausado</option><option value="hecho">Hecho</option></select></Field>}
      {error && <p className="error-msg">{error}</p>}
      <button className="btn-primary" onClick={guardar} disabled={!nombre}>Guardar</button>
    </Modal>
  );
}
