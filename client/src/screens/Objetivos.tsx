import { useState } from 'react';
import { api, pct } from '../api';
import { Page, useCargar, Modal, Field, Vacio, Progress, confirmar, toast } from '../ui';
import { Icono } from '../icons';
import { useAreas, FiltroArea } from '../areas';

interface Vinculo { id: number; fuente: string; ref_id: number | null }
interface Objetivo {
  id: number; nombre: string; horizonte: string; area_id: number; area_nombre: string; area_color: string;
  metrica: string | null; unidad: string | null; meta_valor: number; valor_actual: number; progreso: number;
  estado: string; fecha_fin: string | null; vinculos: Vinculo[];
}
interface Habito { id: number; nombre: string }
interface Proyecto { id: number; nombre: string }

export default function Objetivos() {
  const [objs, recargar, cargando] = useCargar<Objetivo[]>(() => api<Objetivo[]>('/objetivos'));
  const [areas] = useAreas();
  const [nuevo, setNuevo] = useState(false);
  const [editar, setEditar] = useState<Objetivo | null>(null);
  const [area, setArea] = useState<number | null>(null);

  const lista = (objs ?? []).filter((o) => area == null || o.area_id === area);

  return (
    <Page titulo="Objetivos" icono="target" accion={<button className="btn-primary" onClick={() => setNuevo(true)}><Icono name="plus" size={16} /> Objetivo</button>}>
      {areas && <FiltroArea areas={areas} value={area} onChange={setArea} />}
      {cargando || !objs ? <p className="muted">Cargando…</p> : lista.length === 0 ? <Vacio texto="Sin objetivos aquí. Define una meta medible." /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {lista.map((o) => {
            const manual = !o.vinculos[0] || o.vinculos[0].fuente === 'manual';
            return (
              <div key={o.id} className="card">
                <div className="row" style={{ borderBottom: 'none', paddingBottom: '0.3rem' }}>
                  <div className="area-chip"><span className="area-dot" style={{ background: o.area_color }} /> <strong>{o.nombre}</strong></div>
                  <div className="btn-row">
                    {o.estado === 'logrado' && <span className="pill" style={{ color: 'var(--success)' }}>✓ logrado</span>}
                    <button className="icon-btn" onClick={() => setEditar(o)} aria-label="Editar objetivo"><Icono name="edit" size={15} /></button>
                    <button className="icon-btn" onClick={async () => { if (await confirmar(`¿Borrar el objetivo "${o.nombre}"?`)) { await api(`/objetivos/${o.id}`, { method: 'DELETE' }); toast('Objetivo borrado'); recargar(); } }} aria-label="Borrar objetivo"><Icono name="trash" size={15} /></button>
                  </div>
                </div>
                <Progress value={o.progreso} color={o.area_color} />
                <div className="row-sub" style={{ marginTop: '0.35rem' }}>
                  {o.valor_actual} / {o.meta_valor} {o.unidad ?? ''} · {pct(o.progreso)} · {o.horizonte}
                  {!manual && ` · auto: ${o.vinculos[0].fuente}`}
                  {o.fecha_fin && ` · vence ${o.fecha_fin}`}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {nuevo && <NuevoObjetivo onClose={() => setNuevo(false)} onSaved={() => { setNuevo(false); recargar(); }} />}
      {editar && <EditarObjetivo objetivo={editar} onClose={() => setEditar(null)} onSaved={() => { setEditar(null); recargar(); }} />}
    </Page>
  );
}

function EditarObjetivo({ objetivo, onClose, onSaved }: { objetivo: Objetivo; onClose: () => void; onSaved: () => void }) {
  const manual = !objetivo.vinculos[0] || objetivo.vinculos[0].fuente === 'manual';
  const [nombre, setNombre] = useState(objetivo.nombre);
  const [meta, setMeta] = useState(String(objetivo.meta_valor));
  const [valor, setValor] = useState(String(objetivo.valor_actual));
  const [unidad, setUnidad] = useState(objetivo.unidad ?? '');
  const [estado, setEstado] = useState(objetivo.estado);
  const [error, setError] = useState('');

  async function guardar() {
    setError('');
    try {
      const body: Record<string, unknown> = { nombre, meta_valor: Number(meta), unidad: unidad || undefined, estado };
      if (manual) body.valor_actual = Number(valor);
      await api(`/objetivos/${objetivo.id}`, { method: 'PATCH', body });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  }

  return (
    <Modal titulo="Editar objetivo" onClose={onClose}>
      <Field label="Nombre"><input value={nombre} onChange={(e) => setNombre(e.target.value)} /></Field>
      <Field label="Meta (valor)"><input type="number" inputMode="decimal" value={meta} onChange={(e) => setMeta(e.target.value)} /></Field>
      {manual ? (
        <Field label="Valor actual"><input type="number" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} /></Field>
      ) : (
        <p className="row-sub">Valor actual ({objetivo.valor_actual}) se calcula solo desde <strong>{objetivo.vinculos[0].fuente}</strong>; se actualiza en cada revisión semanal.</p>
      )}
      <Field label="Unidad"><input value={unidad} onChange={(e) => setUnidad(e.target.value)} placeholder="MXN, kg, %…" /></Field>
      <Field label="Estado"><select value={estado} onChange={(e) => setEstado(e.target.value)}><option value="activo">Activo</option><option value="logrado">Logrado</option><option value="vencido">Vencido</option></select></Field>
      {error && <p className="error-msg">{error}</p>}
      <button className="btn-primary" onClick={guardar} disabled={!nombre || !meta}>Guardar</button>
    </Modal>
  );
}

function NuevoObjetivo({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [areas] = useAreas();
  const [nombre, setNombre] = useState('');
  const [areaId, setAreaId] = useState<number | ''>('');
  const [horizonte, setHorizonte] = useState('trimestral');
  const [meta, setMeta] = useState('');
  const [unidad, setUnidad] = useState('');
  const [fuente, setFuente] = useState<'manual' | 'habito' | 'proyecto' | 'kpi_financiero'>('manual');
  const [refId, setRefId] = useState<number | ''>('');
  const [error, setError] = useState('');
  const [habitos] = useCargar<{ habitos: Habito[] }>(() => api('/habitos'));
  const [proyectos] = useCargar<Proyecto[]>(() => api('/tareas/proyectos'));

  async function guardar() {
    setError('');
    try {
      const { id } = await api<{ id: number }>('/objetivos', { method: 'POST', body: {
        nombre, horizonte, meta_valor: Number(meta), unidad: unidad || undefined, area_id: areaId || undefined,
      } });
      if (fuente !== 'manual') {
        await api(`/objetivos/${id}/vinculos`, { method: 'POST', body: { fuente, ref_id: refId || null } });
      }
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  }

  return (
    <Modal titulo="Nuevo objetivo" onClose={onClose}>
      <Field label="Nombre"><input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Llegar a $X de patrimonio…" /></Field>
      <Field label="Área"><select value={areaId} onChange={(e) => setAreaId(e.target.value ? Number(e.target.value) : '')}><option value="">— predeterminada —</option>{(areas ?? []).map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></Field>
      <Field label="Horizonte"><select value={horizonte} onChange={(e) => setHorizonte(e.target.value)}><option value="trimestral">Trimestral</option><option value="anual">Anual</option></select></Field>
      <Field label="Meta (valor)"><input type="number" value={meta} onChange={(e) => setMeta(e.target.value)} /></Field>
      <Field label="Unidad"><input value={unidad} onChange={(e) => setUnidad(e.target.value)} placeholder="MXN, kg, %…" /></Field>
      <Field label="Progreso desde">
        <select value={fuente} onChange={(e) => { setFuente(e.target.value as typeof fuente); setRefId(''); }}>
          <option value="manual">Manual</option>
          <option value="habito">Cumplimiento de un hábito</option>
          <option value="proyecto">Avance de un proyecto</option>
          <option value="kpi_financiero">Patrimonio neto (KPI)</option>
        </select>
      </Field>
      {fuente === 'habito' && <Field label="Hábito"><select value={refId} onChange={(e) => setRefId(Number(e.target.value))}><option value="">—</option>{(habitos?.habitos ?? []).map((h) => <option key={h.id} value={h.id}>{h.nombre}</option>)}</select></Field>}
      {fuente === 'proyecto' && <Field label="Proyecto"><select value={refId} onChange={(e) => setRefId(Number(e.target.value))}><option value="">—</option>{(proyectos ?? []).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Field>}
      {error && <p className="error-msg">{error}</p>}
      <button className="btn-primary" onClick={guardar} disabled={!nombre || !meta}>Guardar</button>
    </Modal>
  );
}
