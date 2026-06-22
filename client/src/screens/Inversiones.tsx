import { useState } from 'react';
import { api, mxn, pct } from '../api';
import { Page, useCargar, Stat, Modal, Field, Vacio } from '../ui';
import { Icono } from '../icons';

interface Pos {
  id: number; ticker: string; nombre: string | null; clase: string; moneda: string;
  cantidad: number; precio_compra_prom: number; precio_actual: number | null;
  costo: number; valor_actual: number | null; pnl: number | null; rendimiento: number | null; valor_mxn: number | null;
}
interface Port {
  disponible: boolean; fx_usd_mxn: number | null;
  posiciones: Pos[];
  totales: { costo_mxn: number; valor_mxn: number; pnl_mxn: number; rendimiento: number };
}

export default function Inversiones() {
  const [p, recargar, cargando, error] = useCargar<Port>(() => api<Port>('/inversiones'));
  const [nuevo, setNuevo] = useState(false);

  return (
    <Page titulo="Inversiones" icono="trending" accion={<button className="btn-primary" onClick={() => setNuevo(true)}><Icono name="plus" size={16} /> Posición</button>}>
      {error && <p className="error-msg">{error}</p>}
      {cargando || !p ? <p className="muted">Cargando…</p> : (
        <>
          {!p.disponible && <div className="aviso">Precios no configurados: agrega <b>FINNHUB_API_KEY</b> en el servidor para valuar a mercado. Mientras, ves tu costo.</div>}
          <div className="stat-grid">
            <Stat label="Valor (MXN)" valor={mxn(p.totales.valor_mxn)} />
            <Stat label="Costo (MXN)" valor={mxn(p.totales.costo_mxn)} />
            <Stat label="P&L" valor={mxn(p.totales.pnl_mxn)} sub={pct(p.totales.rendimiento)} color={p.totales.pnl_mxn >= 0 ? 'var(--success)' : 'var(--danger)'} />
            <Stat label="USD/MXN" valor={p.fx_usd_mxn ? p.fx_usd_mxn.toFixed(2) : '—'} />
          </div>
          <div className="card section-gap">
            {p.posiciones.length === 0 ? <Vacio texto="Sin posiciones. Captura las que tengas." /> : p.posiciones.map((pos) => (
              <div key={pos.id} className="row">
                <div className="row-main">
                  <span className="row-title">{pos.ticker} <span className="row-sub">{pos.nombre ?? pos.clase}</span></span>
                  <span className="row-sub">{pos.cantidad} @ {pos.precio_compra_prom} {pos.moneda} · ahora {pos.precio_actual ?? '—'}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="row-amount">{pos.valor_mxn != null ? mxn(pos.valor_mxn) : mxn(pos.costo)}</div>
                  {pos.pnl != null && <div className={`row-sub ${pos.pnl >= 0 ? 'pos' : 'neg'}`}>{pos.pnl >= 0 ? '+' : ''}{pct(pos.rendimiento)}</div>}
                </div>
                <button className="icon-btn" onClick={async () => { if (confirm('¿Borrar posición?')) { await api(`/inversiones/posiciones/${pos.id}`, { method: 'DELETE' }); recargar(); } }}><Icono name="trash" size={15} /></button>
              </div>
            ))}
          </div>
        </>
      )}
      {nuevo && <NuevaPosicion onClose={() => setNuevo(false)} onSaved={() => { setNuevo(false); recargar(); }} />}
    </Page>
  );
}

function NuevaPosicion({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [ticker, setTicker] = useState('');
  const [nombre, setNombre] = useState('');
  const [clase, setClase] = useState<'stock' | 'etf' | 'crypto'>('etf');
  const [cantidad, setCantidad] = useState('');
  const [precio, setPrecio] = useState('');
  const [moneda, setMoneda] = useState('USD');
  const [error, setError] = useState('');

  async function guardar() {
    setError('');
    try {
      await api('/inversiones/posiciones', { method: 'POST', body: {
        ticker, nombre: nombre || undefined, clase, cantidad: Number(cantidad), precio_compra_prom: Number(precio), moneda,
      } });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  }

  return (
    <Modal titulo="Nueva posición" onClose={onClose}>
      <Field label="Ticker"><input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="QQQM, SCHX…" /></Field>
      <Field label="Nombre (opcional)"><input value={nombre} onChange={(e) => setNombre(e.target.value)} /></Field>
      <Field label="Clase"><select value={clase} onChange={(e) => setClase(e.target.value as 'stock' | 'etf' | 'crypto')}><option value="etf">ETF</option><option value="stock">Acción</option><option value="crypto">Crypto</option></select></Field>
      <Field label="Cantidad"><input type="number" inputMode="decimal" value={cantidad} onChange={(e) => setCantidad(e.target.value)} /></Field>
      <Field label="Precio compra prom."><input type="number" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} /></Field>
      <Field label="Moneda"><select value={moneda} onChange={(e) => setMoneda(e.target.value)}><option value="USD">USD</option><option value="MXN">MXN</option></select></Field>
      {error && <p className="error-msg">{error}</p>}
      <button className="btn-primary" onClick={guardar} disabled={!ticker || !cantidad || !precio}>Guardar</button>
    </Modal>
  );
}
