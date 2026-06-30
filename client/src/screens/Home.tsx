import { useState } from 'react';
import { api, mxn, pct } from '../api';
import { Icono } from '../icons';
import { Page, useCargar, Stat, Progress, Vacio, LineChart } from '../ui';
import { useAuth } from '../auth';

function saludoHora(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}
const FECHA_FMT = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

interface Dash {
  fecha: string;
  habitos: { total: number; hechos_hoy: number; lista: { id: number; nombre: string; area_color: string; hecho_hoy: boolean; racha: number }[] };
  tareas_hoy: { id: number; titulo: string; prioridad: string }[];
  proyectos_activos: { id: number; nombre: string; area_color: string; avance: number }[];
  peso: { ultimo: { fecha: string; peso: number } | null; variacion: number | null; serie: { fecha: string; peso: number; media_movil: number }[] };
  patrimonio: { neto: number; activos: number; pasivos: number; portafolio_mxn: number | null; portafolio_pnl: number | null };
  objetivos: { id: number; nombre: string; area_color: string; progreso: number; estado: string; meta_valor: number; valor_actual: number; unidad: string | null }[];
}

export default function Home() {
  const { usuario } = useAuth();
  const [d, recargar, cargando, error] = useCargar<Dash>(() => api<Dash>('/dashboard'));
  const [ocupado, setOcupado] = useState(false);
  const [peso, setPeso] = useState('');
  const nombre = usuario?.nombre?.split(' ')[0] ?? '';

  // Una acción a la vez: evita doble-toque y condiciones de carrera al recargar.
  async function accion(fn: () => Promise<unknown>) {
    if (ocupado) return;
    setOcupado(true);
    try { await fn(); recargar(); } finally { setOcupado(false); }
  }

  async function toggleHabito(h: Dash['habitos']['lista'][number]) {
    if (!d) return;
    if (h.hecho_hoy) await api(`/habitos/${h.id}/registro?fecha=${d.fecha}`, { method: 'DELETE' });
    else await api(`/habitos/${h.id}/registro`, { method: 'POST', body: { fecha: d.fecha, completado: true } });
  }
  async function completarTarea(id: number) {
    await api(`/tareas/${id}`, { method: 'PATCH', body: { estado: 'hecha' } });
  }
  async function registrarPeso() {
    if (!peso) return;
    await api('/salud/peso', { method: 'POST', body: { peso: Number(peso) } });
    setPeso('');
  }

  if (error) return <Page titulo="Inicio" icono="home"><p className="error-msg">{error}</p></Page>;
  if (cargando || !d) return <Page titulo="Inicio" icono="home"><p className="muted">Cargando…</p></Page>;

  const pesoHoy = d.peso.ultimo?.fecha === d.fecha;
  const habitosPend = d.habitos.total - d.habitos.hechos_hoy;
  const pendientes: string[] = [];
  if (!pesoHoy) pendientes.push('pesarte');
  if (habitosPend > 0) pendientes.push(`${habitosPend} hábito${habitosPend > 1 ? 's' : ''}`);
  if (d.tareas_hoy.length > 0) pendientes.push(`${d.tareas_hoy.length} tarea${d.tareas_hoy.length > 1 ? 's' : ''}`);

  return (
    <Page titulo="Inicio" icono="home">
      <div className="hero">
        <div>
          <p className="hero-saludo">{saludoHora()}{nombre ? `, ${nombre}` : ''}.</p>
          <p className="hero-fecha">{FECHA_FMT.format(new Date())}</p>
        </div>
        <div className="hero-anillo"><Anillo valor={d.habitos.total ? d.habitos.hechos_hoy / d.habitos.total : 0} /></div>
      </div>

      <div className={`hoy-nudge ${pendientes.length === 0 ? 'hoy-nudge--ok' : ''}`}>
        <Icono name={pendientes.length === 0 ? 'checks' : 'sparkles'} size={18} />
        <span>{pendientes.length === 0 ? 'Todo al día por hoy. 🎉' : <>Hoy te falta: <strong>{pendientes.join(' · ')}</strong></>}</span>
      </div>

      <div className="stat-grid" style={{ marginBottom: '1rem' }}>
        <Stat label="Patrimonio neto" valor={mxn(d.patrimonio.neto)} sub={`Activos ${mxn(d.patrimonio.activos)} · Pasivos ${mxn(d.patrimonio.pasivos)}`} />
        <Stat label="Portafolio" valor={d.patrimonio.portafolio_mxn != null ? mxn(d.patrimonio.portafolio_mxn) : '—'} sub={d.patrimonio.portafolio_pnl != null ? `P&L ${mxn(d.patrimonio.portafolio_pnl)}` : 'sin valuar'} color={d.patrimonio.portafolio_pnl != null && d.patrimonio.portafolio_pnl >= 0 ? 'var(--success)' : 'var(--danger)'} />
        <Stat label="Hábitos hoy" valor={`${d.habitos.hechos_hoy}/${d.habitos.total}`} />
        <Stat label="Peso" valor={d.peso.ultimo ? `${d.peso.ultimo.peso} kg` : '—'} sub={d.peso.variacion != null ? `${d.peso.variacion > 0 ? '+' : ''}${d.peso.variacion} kg` : undefined} />
      </div>

      <div className="dash-grid">
        <div className="card">
          <p className="card-title"><Icono name="repeat" size={18} /> Hábitos de hoy <span className="board-count">{d.habitos.hechos_hoy}/{d.habitos.total}</span></p>
          {d.habitos.lista.length === 0 ? <Vacio texto="Sin hábitos. Crea uno en Hábitos." /> : (
            <div>
              {d.habitos.lista.map((h) => (
                <div key={h.id} className="row">
                  <button className={`check ${h.hecho_hoy ? 'check--on' : ''}`} disabled={ocupado} onClick={() => accion(() => toggleHabito(h))} aria-label={h.hecho_hoy ? 'Desmarcar' : 'Marcar hecho'}><Icono name="checks" size={11} /></button>
                  <div className="area-chip" style={{ flex: 1, minWidth: 0 }}><span className="area-dot" style={{ background: h.area_color }} /> {h.nombre}</div>
                  <span className="row-sub">{h.racha > 0 ? `🔥${h.racha}` : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <p className="card-title"><Icono name="checks" size={18} /> Tareas de hoy</p>
          {d.tareas_hoy.length === 0 ? <Vacio texto="Nada vence hoy. 🎉" /> : (
            <div>
              {d.tareas_hoy.map((t) => (
                <div key={t.id} className="row">
                  <button className="check" disabled={ocupado} onClick={() => accion(() => completarTarea(t.id))} aria-label="Completar"><Icono name="checks" size={11} /></button>
                  <span className="row-title" style={{ flex: 1, minWidth: 0 }}>{t.prioridad === 'alta' && <span className="prio-alta" title="Prioridad alta">●</span>} {t.titulo}</span>
                  <span className="row-sub">{t.prioridad}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <p className="card-title"><Icono name="scale" size={18} /> Tendencia de peso</p>
          {!pesoHoy && (
            <div className="captura-bar" style={{ marginBottom: '0.75rem' }}>
              <input type="number" inputMode="decimal" placeholder="Peso de hoy (kg)" value={peso} onChange={(e) => setPeso(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') accion(registrarPeso); }} />
              <button className="btn-primary" disabled={ocupado || !peso} onClick={() => accion(registrarPeso)}>Registrar</button>
            </div>
          )}
          <LineChart points={d.peso.serie.map((p) => p.peso)} segunda={d.peso.serie.map((p) => p.media_movil)} color="var(--data-azulejo)" />
          <p className="row-sub">{pesoHoy ? '✓ Ya registraste tu peso hoy. ' : ''}Línea sólida = peso diario · punteada = media móvil 7 días</p>
        </div>

        <div className="card">
          <p className="card-title"><Icono name="target" size={18} /> Objetivos</p>
          {d.objetivos.length === 0 ? <Vacio texto="Sin objetivos aún." /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              {d.objetivos.map((o) => (
                <div key={o.id}>
                  <div className="row" style={{ borderBottom: 'none', paddingBottom: '0.25rem' }}>
                    <div className="area-chip"><span className="area-dot" style={{ background: o.area_color }} /> {o.nombre}</div>
                    <span className="row-sub">{pct(o.progreso)}</span>
                  </div>
                  <Progress value={o.progreso} color={o.area_color} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <p className="card-title"><Icono name="briefcase" size={18} /> Proyectos activos</p>
          {d.proyectos_activos.length === 0 ? <Vacio texto="Sin proyectos activos." /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              {d.proyectos_activos.map((p) => (
                <div key={p.id}>
                  <div className="row" style={{ borderBottom: 'none', paddingBottom: '0.25rem' }}>
                    <div className="area-chip"><span className="area-dot" style={{ background: p.area_color }} /> {p.nombre}</div>
                    <span className="row-sub">{pct(p.avance)}</span>
                  </div>
                  <Progress value={p.avance} color={p.area_color} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}

/** Anillo de progreso (0..1). Muestra el avance de hábitos del día. */
function Anillo({ valor }: { valor: number }) {
  const r = 26, c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, valor));
  const completo = v >= 1;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="6" />
      <circle cx="32" cy="32" r={r} fill="none" stroke={completo ? 'var(--success)' : 'var(--brand)'} strokeWidth="6"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} transform="rotate(-90 32 32)"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      <text x="32" y="36" textAnchor="middle" fontSize="15" fontWeight="600" fill="var(--ink)" fontFamily="var(--font-ui)">{Math.round(v * 100)}%</text>
    </svg>
  );
}
