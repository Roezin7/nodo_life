import { useState } from 'react';
import { api, pct } from '../api';
import { Page, useCargar, Modal, Field, Vacio, Progress } from '../ui';
import { Icono } from '../icons';

interface DiaCheck { fecha: string; hecho: boolean }
interface Habito {
  id: number; nombre: string; tipo: string; frecuencia: string;
  meta: number | null; hecho_hoy: boolean; racha: number; racha_max: number; dias_semana: number;
  meta_semanal: number; cumplimiento_semanal: number; semana: DiaCheck[];
}
interface Tracker { semana_inicio: string; dias: string[]; habitos: Habito[] }

const DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export default function Habitos() {
  const [t, recargar, cargando] = useCargar<Tracker>(() => api<Tracker>('/habitos'));
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
          <div className="habit-dow">{t.dias.map((_, i) => <span key={i}>{DOW[i]}</span>)}</div>
          {t.habitos.map((h) => (
            <div key={h.id} className="habit-item">
              <div className="habit-item-top">
                <strong>{h.nombre}</strong>
                <div className="habit-item-actions">
                  <button className="icon-btn" onClick={() => setEditar(h)} aria-label="Editar hábito"><Icono name="edit" size={16} /></button>
                  <button className="icon-btn" onClick={() => borrar(h)} aria-label="Eliminar hábito"><Icono name="trash" size={16} /></button>
                </div>
              </div>
              <div className="habit-week">
                {h.semana.map((dia) => (
                  <button key={dia.fecha} className={`habit-day ${dia.hecho ? 'habit-day--on' : ''}`} onClick={() => toggle(h, dia)} title={dia.fecha}>{dia.hecho ? '✓' : ''}</button>
                ))}
              </div>
              <div className="habit-item-stats">
                <span className="row-sub habit-racha">🔥 {h.racha} · máx {h.racha_max} · {h.dias_semana}/{h.meta_semanal}</span>
                <div className="habit-progress"><Progress value={h.cumplimiento_semanal} /></div>
                <span className="row-sub">{pct(h.cumplimiento_semanal)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {nuevo && <HabitoForm onClose={() => setNuevo(false)} onSaved={() => { setNuevo(false); recargar(); }} />}
      {editar && <HabitoForm habito={editar} onClose={() => setEditar(null)} onSaved={() => { setEditar(null); recargar(); }} />}
    </Page>
  );
}

function HabitoForm({ habito, onClose, onSaved }: { habito?: Habito; onClose: () => void; onSaved: () => void }) {
  const [nombre, setNombre] = useState(habito?.nombre ?? '');
  const [frecuencia, setFrecuencia] = useState<'diaria' | 'semanal_x_veces'>((habito?.frecuencia as 'diaria' | 'semanal_x_veces') ?? 'diaria');
  const [meta, setMeta] = useState(habito?.meta != null ? String(habito.meta) : '');
  const [error, setError] = useState('');

  async function guardar() {
    setError('');
    try {
      const body = { nombre, frecuencia, meta: frecuencia === 'semanal_x_veces' && meta ? Number(meta) : null };
      if (habito) await api(`/habitos/${habito.id}`, { method: 'PATCH', body });
      else await api('/habitos', { method: 'POST', body });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  }

  return (
    <Modal titulo={habito ? 'Editar hábito' : 'Nuevo hábito'} onClose={onClose}>
      <Field label="Nombre"><input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Leer, meditar, gym…" /></Field>
      <Field label="Frecuencia"><select value={frecuencia} onChange={(e) => setFrecuencia(e.target.value as 'diaria' | 'semanal_x_veces')}><option value="diaria">Diaria</option><option value="semanal_x_veces">X veces por semana</option></select></Field>
      {frecuencia === 'semanal_x_veces' && <Field label="Veces por semana"><input type="number" value={meta} onChange={(e) => setMeta(e.target.value)} /></Field>}
      {error && <p className="error-msg">{error}</p>}
      <button className="btn-primary" onClick={guardar} disabled={!nombre}>Guardar</button>
    </Modal>
  );
}
