import { useEffect, useState, type ReactNode } from 'react';
import { Icono } from './icons';

/** Carga asíncrona con estado. Devuelve [data, recargar, cargando, error]. */
export function useCargar<T>(fn: () => Promise<T>, deps: unknown[] = []): [T | null, () => void, boolean, string | null] {
  const [data, setData] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let vivo = true;
    setCargando(true);
    fn()
      .then((d) => { if (vivo) { setData(d); setError(null); } })
      .catch((e) => { if (vivo) setError(e instanceof Error ? e.message : 'Error'); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);
  return [data, () => setTick((t) => t + 1), cargando, error];
}

export function Page({ titulo, icono, children, accion }: { titulo: string; icono: Parameters<typeof Icono>[0]['name']; children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="page">
      <header className="page-head">
        <div className="page-title">
          <Icono name={icono} size={24} className="ttl-icon" />
          <h1>{titulo}</h1>
        </div>
        {accion}
      </header>
      <div className="tab-body">{children}</div>
    </div>
  );
}

export function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{titulo}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icono name="x" size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export function Progress({ value, color }: { value: number; color?: string }) {
  return (
    <div className="progress">
      <div className="progress-fill" style={{ width: `${Math.min(value * 100, 100)}%`, background: color ?? 'var(--success)' }} />
    </div>
  );
}

export function Segmented<T extends string>({ value, opciones, onChange }: { value: T; opciones: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented">
      {opciones.map((o) => (
        <button key={o.v} className={o.v === value ? 'seg seg--on' : 'seg'} onClick={() => onChange(o.v)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Stat({ label, valor, sub, color }: { label: string; valor: string; sub?: string; color?: string }) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <span className="stat-val" style={color ? { color } : undefined}>{valor}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

export function Vacio({ texto }: { texto: string }) {
  return <p className="muted" style={{ padding: '1.5rem 0', textAlign: 'center' }}>{texto}</p>;
}

/** Gráfica de línea simple en SVG. points: valores Y; labels opcional. */
export function LineChart({ points, color = 'var(--data-azulejo)', alto = 120, segunda }: { points: number[]; color?: string; alto?: number; segunda?: number[] }) {
  if (points.length < 2) return <Vacio texto="Aún no hay suficientes datos para la tendencia." />;
  const ancho = 320;
  const todos = [...points, ...(segunda ?? [])];
  const min = Math.min(...todos);
  const max = Math.max(...todos);
  const span = max - min || 1;
  const px = (i: number, n: number) => (i / (n - 1)) * (ancho - 8) + 4;
  const py = (v: number) => alto - 6 - ((v - min) / span) * (alto - 12);
  const path = (vals: number[]) => vals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${px(i, vals.length).toFixed(1)} ${py(v).toFixed(1)}`).join(' ');
  return (
    <svg className="linechart" viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="none" width="100%" height={alto}>
      {segunda && segunda.length > 1 && <path d={path(segunda)} fill="none" stroke="var(--ink-3)" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.7} />}
      <path d={path(points)} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
