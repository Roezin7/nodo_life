import { api, mxn, pct } from '../api';
import { Icono } from '../icons';
import { Page, useCargar, Stat, Progress, Vacio, LineChart } from '../ui';

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
  const [d, , cargando, error] = useCargar<Dash>(() => api<Dash>('/dashboard'));

  if (error) return <Page titulo="Inicio" icono="home"><p className="error-msg">{error}</p></Page>;
  if (cargando || !d) return <Page titulo="Inicio" icono="home"><p className="muted">Cargando…</p></Page>;

  return (
    <Page titulo="Inicio" icono="home">
      <div className="stat-grid" style={{ marginBottom: '1rem' }}>
        <Stat label="Patrimonio neto" valor={mxn(d.patrimonio.neto)} sub={`Activos ${mxn(d.patrimonio.activos)} · Pasivos ${mxn(d.patrimonio.pasivos)}`} />
        <Stat label="Portafolio" valor={d.patrimonio.portafolio_mxn != null ? mxn(d.patrimonio.portafolio_mxn) : '—'} sub={d.patrimonio.portafolio_pnl != null ? `P&L ${mxn(d.patrimonio.portafolio_pnl)}` : 'sin valuar'} color={d.patrimonio.portafolio_pnl != null && d.patrimonio.portafolio_pnl >= 0 ? 'var(--success)' : 'var(--danger)'} />
        <Stat label="Hábitos hoy" valor={`${d.habitos.hechos_hoy}/${d.habitos.total}`} />
        <Stat label="Peso" valor={d.peso.ultimo ? `${d.peso.ultimo.peso} kg` : '—'} sub={d.peso.variacion != null ? `${d.peso.variacion > 0 ? '+' : ''}${d.peso.variacion} kg` : undefined} />
      </div>

      <div className="dash-grid">
        <div className="card">
          <p className="card-title"><Icono name="repeat" size={18} /> Hábitos de hoy</p>
          {d.habitos.lista.length === 0 ? <Vacio texto="Sin hábitos. Crea uno en Hábitos." /> : (
            <div>
              {d.habitos.lista.map((h) => (
                <div key={h.id} className="row">
                  <div className="area-chip"><span className="area-dot" style={{ background: h.area_color }} /> {h.nombre}</div>
                  <span className="row-sub">{h.hecho_hoy ? '✓ hecho' : '—'}{h.racha > 0 ? ` · 🔥${h.racha}` : ''}</span>
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
                  <span className="row-title">{t.titulo}</span>
                  <span className="row-sub">{t.prioridad}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <p className="card-title"><Icono name="scale" size={18} /> Tendencia de peso</p>
          <LineChart points={d.peso.serie.map((p) => p.peso)} segunda={d.peso.serie.map((p) => p.media_movil)} color="var(--data-azulejo)" />
          <p className="row-sub">Línea sólida = peso diario · punteada = media móvil 7 días</p>
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
