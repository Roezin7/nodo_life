import { useState } from 'react';
import { api, pct } from '../api';
import { Page, useCargar, Modal, Field, Vacio, Progress } from '../ui';
import { Icono } from '../icons';

interface DiaCheck { fecha: string; hecho: boolean }
interface Habito {
  id: number; nombre: string; area_id: number; area_color: string; tipo: string; frecuencia: string;
  meta: number | null; hecho_hoy: boolean; racha: number; racha_max: number; dias_semana: number;
  meta_semanal: number; cumplimiento_semanal: number; semana: DiaCheck[];
}
interface Tracker { semana_inicio: string; dias: string[]; habitos: Habito[] }
interface Area { id: number; nombre: string; color: string }

const DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export default function Habitos() {
  const [t, recargar, cargando] = useCargar<Tracker>(() => api<Tracker>('/habitos'));
  const [areas] = useCargar<Area[]>(() => api<Area[]>('/areas'));
  const [nuevo, setNuevo] = useState(false);
  const [editar, setEditar] = useState<Habito | null>(null);

  async function toggle(h: Habito, dia: DiaCheck) {
    if (dia.hecho) await api(`/habitos/${h.id}/registro?fecha=${dia.fecha}`, { method: 'DELETE' });
    else await api(`/habitos/${h.id}/registro`, { method: 'POST', body: { fecha: dia.fecha, completado: true } });
    recargar();
  }

  async function borrar(h: Habito) {
    if (!confirm(`¿Eliminar el hábito "${h.nombre}"? Se borrará también su historial.`)) return;
    await api(`/habitos/${h.id}`, { method: 'DELETE' });
    recargar();
  }

  return (
    <Page titulo="Hábitos" icono="repeat" accion={<button className="btn-primary" onClick={() => setNuevo(true)}><Icono name="plus" size={16} /> Hábito</button>}>
      {cargando || !t ? <p className="muted">Cargando…</p> : t.habitos.length === 0 ? <Vacio texto="Sin hábitos. Crea el primero." /> : (
        <div className="card">
          <div className="row" style={{ color: 'var(--ink-3)', fontSize: '0.72rem' }}>
            <span>Hábito</span>
            <div className="habit-week">{t.dias.map((_, i) => <span key={i} className="habit-day" style={{ border: 'none', background: 'none' }}>{DOW[i]}</span>)}</div>
          </div>
          {t.habitos.map((h) => (
            <div key={h.id} style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                <div className="area-chip"><span className="area-dot" style={{ background: h.area_color }} /> <strong>{h.nombre}</strong></div>
                <div className="habit-week">
                  {h.semana.map((dia) => (
                    <button key={dia.fecha} className={`habit-day ${dia.hecho ? 'habit-day--on' : ''}`} onClick={() => toggle(h, dia)} title={dia.fecha}>{dia.hecho ? '✓' : ''}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.35rem', gap: '0.75rem' }}>
                <span className="row-sub">🔥 {h.racha} · máx {h.racha_max} · {h.dias_semana}/{h.meta_semanal} sem</span>
                <div style={{ flex: 1, maxWidth: 120 }}><Progress value={h.cumplimiento_semanal} color={h.area_color} /></div>
                <span className="row-sub">{pct(h.cumplimiento_semanal)}</span>
                <button className="icon-btn" onClick={() => setEditar(h)} aria-label="Editar"><Icono name="edit" size={15} /></button>
                <button className="icon-btn" onClick={() => borrar(h)} aria-label="Eliminar"><Icono name="trash" size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {nuevo && <HabitoForm areas={areas ?? []} onClose={() => setNuevo(false)} onSaved={() => { setNuevo(false); recargar(); }} />}
      {editar && <HabitoForm areas={areas ?? []} habito={editar} onClose={() => setEditar(null)} onSaved={() => { setEditar(null); recargar(); }} />}
    </Page>
  );
}

function HabitoForm({ areas, habito, onClose, onSaved }: { areas: Area[]; habito?: Habito; onClose: () => void; onSaved: () => void }) {
  const [nombre, setNombre] = useState(habito?.nombre ?? '');
  const [area, setArea] = useState<number | ''>(habito?.area_id ?? areas[0]?.id ?? '');
  const [frecuencia, setFrecuencia] = useState<'diaria' | 'semanal_x_veces'>((habito?.frecuencia as 'diaria' | 'semanal_x_veces') ?? 'diaria');
  const [meta, setMeta] = useState(habito?.meta != null ? String(habito.meta) : '');
  const [error, setError] = useState('');

  async function guardar() {
    setError('');
    try {
      const body = { nombre, area_id: area, frecuencia, meta: frecuencia === 'semanal_x_veces' && meta ? Number(meta) : null };
      if (habito) await api(`/habitos/${habito.id}`, { method: 'PATCH', body });
      else await api('/habitos', { method: 'POST', body });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  }

  return (
    <Modal titulo={habito ? 'Editar hábito' : 'Nuevo hábito'} onClose={onClose}>
      <Field label="Nombre"><input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Leer, meditar, gym…" /></Field>
      <Field label="Área"><select value={area} onChange={(e) => setArea(Number(e.target.value))}>{areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></Field>
      <Field label="Frecuencia"><select value={frecuencia} onChange={(e) => setFrecuencia(e.target.value as 'diaria' | 'semanal_x_veces')}><option value="diaria">Diaria</option><option value="semanal_x_veces">X veces por semana</option></select></Field>
      {frecuencia === 'semanal_x_veces' && <Field label="Veces por semana"><input type="number" value={meta} onChange={(e) => setMeta(e.target.value)} /></Field>}
      {error && <p className="error-msg">{error}</p>}
      <button className="btn-primary" onClick={guardar} disabled={!nombre || !area}>Guardar</button>
    </Modal>
  );
}
