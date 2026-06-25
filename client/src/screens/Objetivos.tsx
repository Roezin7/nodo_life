import { useState } from 'react';
import { api, pct } from '../api';
import { Page, useCargar, Modal, Field, Vacio, Progress } from '../ui';
import { Icono } from '../icons';

interface Vinculo { id: number; fuente: string; ref_id: number | null }
interface Objetivo {
  id: number; nombre: string; horizonte: string;
  metrica: string | null; unidad: string | null; meta_valor: number; valor_actual: number; progreso: number;
  estado: string; fecha_fin: string | null; vinculos: Vinculo[];
}
interface Habito { id: number; nombre: string }
interface Proyecto { id: number; nombre: string }

export default function Objetivos() {
  const [objs, recargar, cargando] = useCargar<Objetivo[]>(() => api<Objetivo[]>('/objetivos'));
  const [nuevo, setNuevo] = useState(false);

  return (
    <Page titulo="Objetivos" icono="target" accion={<button className="btn-primary" onClick={() => setNuevo(true)}><Icono name="plus" size={16} /> Objetivo</button>}>
      {cargando || !objs ? <p className="muted">Cargando…</p> : objs.length === 0 ? <Vacio texto="Sin objetivos. Define una meta medible." /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {objs.map((o) => (
            <div key={o.id} className="card">
              <div className="row" style={{ borderBottom: 'none', paddingBottom: '0.3rem' }}>
                <strong>{o.nombre}</strong>
                <button className="icon-btn" onClick={async () => { if (confirm('¿Borrar objetivo?')) { await api(`/objetivos/${o.id}`, { method: 'DELETE' }); recargar(); } }}><Icono name="trash" size={15} /></button>
              </div>
              <Progress value={o.progreso} />
              <div className="row-sub" style={{ marginTop: '0.35rem' }}>
                {o.valor_actual} / {o.meta_valor} {o.unidad ?? ''} · {pct(o.progreso)} · {o.horizonte} · {o.estado}
                {o.vinculos[0] && ` · fuente: ${o.vinculos[0].fuente}`}
                {o.fecha_fin && ` · vence ${o.fecha_fin}`}
              </div>
            </div>
          ))}
        </div>
      )}
      {nuevo && <NuevoObjetivo onClose={() => setNuevo(false)} onSaved={() => { setNuevo(false); recargar(); }} />}
    </Page>
  );
}

function NuevoObjetivo({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [nombre, setNombre] = useState('');
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
        nombre, horizonte, meta_valor: Number(meta), unidad: unidad || undefined,
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
