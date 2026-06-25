import { useState } from 'react';
import { api } from '../api';
import { useCargar } from '../ui';
import { Icono } from '../icons';

interface Accion {
  tipo: 'gasto' | 'ingreso' | 'peso' | 'habito' | 'entrenamiento' | 'tarea';
  confianza: string;
  monto?: number | null; cuenta_id?: number | null; categoria_id?: number | null; area_id?: number | null;
  descripcion?: string | null; peso?: number | null; habito_id?: number | null; tipo_entrenamiento_id?: number | null;
  duracion_min?: number | null; titulo?: string | null; fecha?: string | null;
}
interface Ref { cuentas: { id: number; nombre: string }[]; categorias: { id: number; nombre: string; clase: string }[] }
interface Tracker { habitos: { id: number; nombre: string }[] }
interface Tipo { id: number; nombre: string }

const hoyISO = () => new Date().toISOString().slice(0, 10);

const LABELS: Record<Accion['tipo'], string> = {
  gasto: 'Gasto', ingreso: 'Ingreso', peso: 'Peso', habito: 'Hábito', entrenamiento: 'Entrenamiento', tarea: 'Tarea',
};

export default function CapturaDraft() {
  const [texto, setTexto] = useState('');
  const [acciones, setAcciones] = useState<Accion[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [hechas, setHechas] = useState<Set<number>>(new Set());

  const [ref] = useCargar<Ref>(() => api<Ref>('/finanzas/referencias'));
  const [tracker] = useCargar<Tracker>(() => api<Tracker>('/habitos'));
  const [tipos] = useCargar<Tipo[]>(() => api<Tipo[]>('/salud/tipos'));

  async function proponer() {
    if (!texto.trim()) return;
    setCargando(true); setError(''); setAcciones(null); setHechas(new Set());
    try {
      const r = await api<{ acciones: Accion[] }>('/silvia/captura', { method: 'POST', body: { texto } });
      setAcciones(r.acciones);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setCargando(false); }
  }

  function actualizar(i: number, patch: Partial<Accion>) {
    setAcciones((a) => a?.map((x, j) => (j === i ? { ...x, ...patch } : x)) ?? null);
  }

  async function confirmar(a: Accion, i: number) {
    try {
      if (a.tipo === 'gasto' || a.tipo === 'ingreso') {
        await api('/finanzas/movimientos', { method: 'POST', body: {
          tipo: a.tipo, monto: a.monto,
          cuenta_origen_id: a.tipo === 'gasto' ? a.cuenta_id ?? null : null,
          cuenta_destino_id: a.tipo === 'ingreso' ? a.cuenta_id ?? null : null,
          categoria_id: a.categoria_id ?? null, descripcion: a.descripcion ?? undefined, fecha: a.fecha ?? undefined,
        } });
      } else if (a.tipo === 'peso') {
        await api('/salud/peso', { method: 'POST', body: { peso: a.peso, fecha: a.fecha ?? undefined } });
      } else if (a.tipo === 'habito' && a.habito_id) {
        await api(`/habitos/${a.habito_id}/registro`, { method: 'POST', body: { completado: true, fecha: a.fecha ?? undefined } });
      } else if (a.tipo === 'entrenamiento' && a.tipo_entrenamiento_id) {
        await api('/salud/entrenamientos', { method: 'POST', body: { tipo_id: a.tipo_entrenamiento_id, duracion_min: a.duracion_min ?? undefined, notas: a.descripcion ?? undefined, fecha: a.fecha ?? undefined } });
      } else if (a.tipo === 'tarea') {
        await api('/tareas', { method: 'POST', body: { titulo: a.titulo, fecha_vence: a.fecha ?? hoyISO() } });
      }
      setHechas((s) => new Set(s).add(i));
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al confirmar'); }
  }

  return (
    <div className="silvia-msgs" style={{ paddingTop: '0.5rem' }}>
      <div className="captura-bar">
        <input placeholder='Ej: "gasté 500 en súper", "pesé 78.4"' value={texto} onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') proponer(); }} />
        <button className="btn-primary" onClick={proponer} disabled={cargando}><Icono name="sparkles" size={16} /></button>
      </div>
      {cargando && <p className="muted">Silvia está interpretando…</p>}
      {error && <p className="error-msg">{error}</p>}
      {acciones && acciones.length === 0 && <p className="muted">No detecté nada que registrar. Sé más específico.</p>}
      {acciones?.map((a, i) => (
        <div key={i} className="card" style={{ marginBottom: '0.6rem', opacity: hechas.has(i) ? 0.5 : 1 }}>
          <p className="card-title">{LABELS[a.tipo]} <span className="muted" style={{ fontSize: '0.7rem' }}>({a.confianza})</span></p>
          {(a.tipo === 'gasto' || a.tipo === 'ingreso') && (
            <>
              <input className="inp" type="number" placeholder="Monto" value={a.monto ?? ''} onChange={(e) => actualizar(i, { monto: Number(e.target.value) })} style={{ marginBottom: 6 }} />
              <select className="inp" value={a.cuenta_id ?? ''} onChange={(e) => actualizar(i, { cuenta_id: Number(e.target.value) })} style={{ marginBottom: 6 }}>
                <option value="">Cuenta…</option>{(ref?.cuentas ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <select className="inp" value={a.categoria_id ?? ''} onChange={(e) => actualizar(i, { categoria_id: Number(e.target.value) })} style={{ marginBottom: 6 }}>
                <option value="">Categoría…</option>{(ref?.categorias ?? []).filter((c) => c.clase === a.tipo).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <input className="inp" placeholder="Descripción" value={a.descripcion ?? ''} onChange={(e) => actualizar(i, { descripcion: e.target.value })} />
            </>
          )}
          {a.tipo === 'peso' && <input className="inp" type="number" placeholder="Peso kg" value={a.peso ?? ''} onChange={(e) => actualizar(i, { peso: Number(e.target.value) })} />}
          {a.tipo === 'habito' && (
            <select className="inp" value={a.habito_id ?? ''} onChange={(e) => actualizar(i, { habito_id: Number(e.target.value) })}>
              <option value="">Hábito…</option>{(tracker?.habitos ?? []).map((h) => <option key={h.id} value={h.id}>{h.nombre}</option>)}
            </select>
          )}
          {a.tipo === 'entrenamiento' && (
            <select className="inp" value={a.tipo_entrenamiento_id ?? ''} onChange={(e) => actualizar(i, { tipo_entrenamiento_id: Number(e.target.value) })}>
              <option value="">Tipo…</option>{(tipos ?? []).map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          )}
          {a.tipo === 'tarea' && (
            <>
              <input className="inp" placeholder="Título" value={a.titulo ?? ''} onChange={(e) => actualizar(i, { titulo: e.target.value })} style={{ marginBottom: 6 }} />
              <input className="inp" type="date" value={a.fecha ?? hoyISO()} onChange={(e) => actualizar(i, { fecha: e.target.value })} />
            </>
          )}
          <button className="btn-primary" style={{ marginTop: 8 }} onClick={() => confirmar(a, i)} disabled={hechas.has(i)}>
            {hechas.has(i) ? '✓ Registrado' : 'Confirmar'}
          </button>
        </div>
      ))}
    </div>
  );
}
