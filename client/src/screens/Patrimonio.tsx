import { api, mxn } from '../api';
import { Page, useCargar, Stat, LineChart, Vacio } from '../ui';
import { Icono } from '../icons';

interface Vivo {
  fecha: string; total_activos: number; total_pasivos: number; patrimonio_neto: number;
  desglose: { cuentas: { cuenta_id: number; nombre: string; saldo: number }[]; inversiones_mxn: number; por_cobrar: number; deudas: number };
  sugerir_snapshot: boolean; cadencia_dias: number;
}
interface Snap { id: number; fecha: string; patrimonio_neto: number; total_activos: number; total_pasivos: number }

export default function Patrimonio() {
  const [vivo, recargarVivo, cargando] = useCargar<Vivo>(() => api<Vivo>('/patrimonio'));
  const [snaps, recargarSnaps] = useCargar<Snap[]>(() => api<Snap[]>('/patrimonio/snapshots'));

  async function snapshot() {
    await api('/patrimonio/snapshots', { method: 'POST', body: {} });
    recargarVivo(); recargarSnaps();
  }

  return (
    <Page titulo="Patrimonio" icono="growth" accion={<button className="btn-primary" onClick={snapshot}><Icono name="plus" size={16} /> Snapshot</button>}>
      {cargando || !vivo ? <p className="muted">Cargando…</p> : (
        <>
          {vivo.sugerir_snapshot && <div className="aviso">Pasaron {vivo.cadencia_dias}+ días desde tu último snapshot. Captura uno para seguir la tendencia.</div>}
          <div className="stat-grid">
            <Stat label="Patrimonio neto" valor={mxn(vivo.patrimonio_neto)} />
            <Stat label="Activos" valor={mxn(vivo.total_activos)} color="var(--success)" />
            <Stat label="Pasivos" valor={mxn(vivo.total_pasivos)} color="var(--danger)" />
            <Stat label="Inversiones" valor={mxn(vivo.desglose.inversiones_mxn)} />
          </div>

          <div className="card section-gap">
            <p className="card-title">Tendencia del patrimonio neto</p>
            {!snaps || snaps.length < 2 ? <Vacio texto="Captura snapshots para ver la tendencia." /> : (
              <LineChart points={snaps.map((s) => s.patrimonio_neto)} color="var(--success)" alto={140} />
            )}
          </div>

          <div className="card section-gap">
            <p className="card-title">Desglose actual</p>
            {vivo.desglose.cuentas.map((c) => (
              <div key={c.cuenta_id} className="row"><span className="row-title">{c.nombre}</span><span className="row-amount">{mxn(c.saldo)}</span></div>
            ))}
            <div className="row"><span className="row-title">Inversiones (a mercado)</span><span className="row-amount">{mxn(vivo.desglose.inversiones_mxn)}</span></div>
            <div className="row"><span className="row-title">Por cobrar</span><span className="row-amount pos">{mxn(vivo.desglose.por_cobrar)}</span></div>
            <div className="row"><span className="row-title">Deudas</span><span className="row-amount neg">−{mxn(vivo.desglose.deudas)}</span></div>
          </div>

          {snaps && snaps.length > 0 && (
            <div className="card section-gap">
              <p className="card-title">Snapshots</p>
              {snaps.slice().reverse().map((s) => (
                <div key={s.id} className="row">
                  <span className="row-title">{s.fecha}</span>
                  <span className="row-amount">{mxn(s.patrimonio_neto)}</span>
                  <button className="icon-btn" onClick={async () => { if (confirm('¿Borrar snapshot?')) { await api(`/patrimonio/snapshots/${s.id}`, { method: 'DELETE' }); recargarSnaps(); } }}><Icono name="trash" size={15} /></button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Page>
  );
}
