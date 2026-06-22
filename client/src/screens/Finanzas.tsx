import { useState } from 'react';
import { api, mxn, pct } from '../api';
import { Page, useCargar, Stat, Progress, Modal, Field, Segmented, Vacio } from '../ui';
import { Icono } from '../icons';

interface Cuenta { id: number; nombre: string; tipo_id: number; moneda: string; es_central: boolean; saldo: number }
interface Categoria { id: number; nombre: string; clase: 'ingreso' | 'gasto'; area_id: number | null }
interface Ref { tipos_cuenta: { id: number; nombre: string }[]; cuentas: Cuenta[]; categorias: Categoria[] }
interface Area { id: number; nombre: string; color: string }
interface Mov { id: number; fecha: string; tipo: string; monto: number; cuenta_origen_id: number | null; cuenta_destino_id: number | null; categoria_id: number | null; area_id: number | null; descripcion: string | null }
interface Dash {
  mes: string;
  resumen: { ingresos: number; gastos: number; flujo: number; tasa_ahorro: number };
  saldos: { cuenta_id: number; nombre: string; saldo: number }[];
  total_liquido: number; por_cobrar: number; deudas: number; patrimonio_liquido: number;
  gasto_por_categoria: { categoria_id: number; nombre: string; monto: number }[];
  gasto_por_area: { area_id: number; nombre: string; color: string; monto: number }[];
  presupuestos: { id: number; etiqueta: string; gastado: number; limite: number; ratio: number; nivel: string }[];
}

const hoyMes = () => new Date().toISOString().slice(0, 7);
type Tab = 'resumen' | 'movimientos' | 'cobrar' | 'deudas';

export default function Finanzas() {
  const [tab, setTab] = useState<Tab>('resumen');
  const [mes, setMes] = useState(hoyMes());
  const [ref, recargarRef] = useCargar<Ref>(() => api<Ref>('/finanzas/referencias'));
  const [areas] = useCargar<Area[]>(() => api<Area[]>('/areas'));
  const [nuevo, setNuevo] = useState(false);

  return (
    <Page titulo="Dinero" icono="wallet" accion={<button className="btn-primary" onClick={() => setNuevo(true)}><Icono name="plus" size={16} /> Movimiento</button>}>
      <Segmented value={tab} onChange={setTab} opciones={[
        { v: 'resumen', label: 'Resumen' },
        { v: 'movimientos', label: 'Movimientos' },
        { v: 'cobrar', label: 'Por cobrar' },
        { v: 'deudas', label: 'Deudas' },
      ]} />
      <div className="section-gap">
        {tab === 'resumen' && <Resumen mes={mes} setMes={setMes} />}
        {tab === 'movimientos' && ref && <Movimientos mes={mes} setMes={setMes} ref_={ref} areas={areas ?? []} />}
        {tab === 'cobrar' && <CobrarDeudas modo="cobrar" />}
        {tab === 'deudas' && <CobrarDeudas modo="deudas" />}
      </div>
      {nuevo && ref && <NuevoMovimiento ref_={ref} areas={areas ?? []} onClose={() => setNuevo(false)} onSaved={() => { setNuevo(false); recargarRef(); }} />}
    </Page>
  );
}

function MesNav({ mes, setMes }: { mes: string; setMes: (m: string) => void }) {
  const shift = (n: number) => {
    const d = new Date(mes + '-01T00:00:00Z');
    d.setUTCMonth(d.getUTCMonth() + n);
    setMes(d.toISOString().slice(0, 7));
  };
  return (
    <div className="btn-row" style={{ alignItems: 'center', marginBottom: '0.75rem' }}>
      <button className="pill" onClick={() => shift(-1)}><Icono name="back" size={14} /></button>
      <strong style={{ fontFamily: 'var(--font-mono)' }}>{mes}</strong>
      <button className="pill" onClick={() => shift(1)}><Icono name="chevron" size={14} /></button>
    </div>
  );
}

function Resumen({ mes, setMes }: { mes: string; setMes: (m: string) => void }) {
  const [d, , cargando] = useCargar<Dash>(() => api<Dash>(`/finanzas/dashboard?mes=${mes}`), [mes]);
  if (cargando || !d) return <p className="muted">Cargando…</p>;
  return (
    <>
      <MesNav mes={mes} setMes={setMes} />
      <div className="stat-grid">
        <Stat label="Ingresos" valor={mxn(d.resumen.ingresos)} color="var(--success)" />
        <Stat label="Gastos" valor={mxn(d.resumen.gastos)} color="var(--danger)" />
        <Stat label="Flujo" valor={mxn(d.resumen.flujo)} />
        <Stat label="Tasa de ahorro" valor={pct(d.resumen.tasa_ahorro)} />
        <Stat label="Líquido total" valor={mxn(d.total_liquido)} />
        <Stat label="Patrimonio líquido" valor={mxn(d.patrimonio_liquido)} sub={`+ inversiones en Patrimonio`} />
      </div>

      <div className="card section-gap">
        <p className="card-title">Saldos por cuenta</p>
        {d.saldos.map((s) => (
          <div key={s.cuenta_id} className="row"><span className="row-title">{s.nombre}</span><span className="row-amount">{mxn(s.saldo)}</span></div>
        ))}
      </div>

      <div className="card section-gap">
        <p className="card-title">Gasto por área</p>
        {d.gasto_por_area.filter((a) => a.monto > 0).length === 0 ? <Vacio texto="Sin gastos este mes." /> :
          d.gasto_por_area.filter((a) => a.monto > 0).map((a) => (
            <div key={a.area_id} className="row"><div className="area-chip"><span className="area-dot" style={{ background: a.color }} />{a.nombre}</div><span className="row-amount">{mxn(a.monto)}</span></div>
          ))}
      </div>

      {d.presupuestos.length > 0 && (
        <div className="card section-gap">
          <p className="card-title">Presupuestos</p>
          {d.presupuestos.map((p) => (
            <div key={p.id} style={{ marginBottom: '0.7rem' }}>
              <div className="row" style={{ borderBottom: 'none', paddingBottom: '0.25rem' }}>
                <span className="row-title">{p.etiqueta}</span>
                <span className="row-sub">{mxn(p.gastado)} / {mxn(p.limite)}</span>
              </div>
              <Progress value={p.ratio} color={p.nivel === 'excedido' ? 'var(--danger)' : p.nivel === 'cerca' ? 'var(--warning)' : 'var(--success)'} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Movimientos({ mes, setMes, ref_, areas }: { mes: string; setMes: (m: string) => void; ref_: Ref; areas: Area[] }) {
  const [movs, recargar, cargando] = useCargar<Mov[]>(() => api<Mov[]>(`/finanzas/movimientos?mes=${mes}`), [mes]);
  const cuentaNombre = (id: number | null) => ref_.cuentas.find((c) => c.id === id)?.nombre ?? '';
  const catNombre = (id: number | null) => ref_.categorias.find((c) => c.id === id)?.nombre ?? '';
  const areaColor = (id: number | null) => areas.find((a) => a.id === id)?.color;

  async function borrar(id: number) {
    if (!confirm('¿Borrar movimiento?')) return;
    await api(`/finanzas/movimientos/${id}`, { method: 'DELETE' });
    recargar();
  }

  return (
    <>
      <MesNav mes={mes} setMes={setMes} />
      {cargando || !movs ? <p className="muted">Cargando…</p> : movs.length === 0 ? <Vacio texto="Sin movimientos este mes." /> : (
        <div className="card">
          {movs.map((m) => {
            const signo = m.tipo === 'ingreso' ? '+' : m.tipo === 'gasto' ? '−' : '';
            return (
              <div key={m.id} className="row">
                <div className="row-main">
                  <span className="row-title">{m.descripcion || catNombre(m.categoria_id) || m.tipo}</span>
                  <span className="row-sub">
                    {m.fecha} · {m.tipo === 'transferencia' ? `${cuentaNombre(m.cuenta_origen_id)} → ${cuentaNombre(m.cuenta_destino_id)}` : cuentaNombre(m.cuenta_origen_id ?? m.cuenta_destino_id)}
                    {areaColor(m.area_id) && <span className="area-dot" style={{ background: areaColor(m.area_id), display: 'inline-block', marginLeft: 6 }} />}
                  </span>
                </div>
                <span className={`row-amount ${m.tipo === 'ingreso' ? 'pos' : m.tipo === 'gasto' ? 'neg' : ''}`}>{signo}{mxn(m.monto)}</span>
                <button className="icon-btn" onClick={() => borrar(m.id)}><Icono name="trash" size={15} /></button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function NuevoMovimiento({ ref_, areas, onClose, onSaved }: { ref_: Ref; areas: Area[]; onClose: () => void; onSaved: () => void }) {
  const [tipo, setTipo] = useState<'gasto' | 'ingreso' | 'transferencia'>('gasto');
  const [monto, setMonto] = useState('');
  const [origen, setOrigen] = useState<number | ''>(ref_.cuentas[0]?.id ?? '');
  const [destino, setDestino] = useState<number | ''>(ref_.cuentas[0]?.id ?? '');
  const [categoria, setCategoria] = useState<number | ''>('');
  const [area, setArea] = useState<number | ''>('');
  const [desc, setDesc] = useState('');
  const [error, setError] = useState('');
  const cats = ref_.categorias.filter((c) => c.clase === (tipo === 'ingreso' ? 'ingreso' : 'gasto'));

  async function guardar() {
    setError('');
    try {
      await api('/finanzas/movimientos', { method: 'POST', body: {
        tipo, monto: Number(monto),
        cuenta_origen_id: tipo !== 'ingreso' ? origen || null : null,
        cuenta_destino_id: tipo !== 'gasto' ? destino || null : null,
        categoria_id: tipo !== 'transferencia' ? (categoria || null) : null,
        area_id: area || null,
        descripcion: desc || undefined,
      } });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  }

  return (
    <Modal titulo="Nuevo movimiento" onClose={onClose}>
      <Segmented value={tipo} onChange={setTipo} opciones={[{ v: 'gasto', label: 'Gasto' }, { v: 'ingreso', label: 'Ingreso' }, { v: 'transferencia', label: 'Transferencia' }]} />
      <Field label="Monto (MXN)"><input type="number" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" /></Field>
      {tipo !== 'ingreso' && (
        <Field label="Cuenta origen"><select value={origen} onChange={(e) => setOrigen(Number(e.target.value))}>{ref_.cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Field>
      )}
      {tipo !== 'gasto' && (
        <Field label="Cuenta destino"><select value={destino} onChange={(e) => setDestino(Number(e.target.value))}>{ref_.cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Field>
      )}
      {tipo !== 'transferencia' && (
        <Field label="Categoría"><select value={categoria} onChange={(e) => setCategoria(Number(e.target.value))}><option value="">—</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Field>
      )}
      <Field label="Área"><select value={area} onChange={(e) => setArea(Number(e.target.value))}><option value="">—</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></Field>
      <Field label="Descripción"><input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="opcional" /></Field>
      {error && <p className="error-msg">{error}</p>}
      <button className="btn-primary" onClick={guardar}>Guardar</button>
    </Modal>
  );
}

interface ItemCD { id: number; descripcion: string; deudor?: string; acreedor?: string; monto: number; fecha: string; estado: string }
function CobrarDeudas({ modo }: { modo: 'cobrar' | 'deudas' }) {
  const path = modo === 'cobrar' ? '/finanzas/por-cobrar' : '/finanzas/deudas';
  const [items, recargar, cargando] = useCargar<ItemCD[]>(() => api<ItemCD[]>(path), [modo]);
  const [nuevo, setNuevo] = useState(false);
  const [desc, setDesc] = useState('');
  const [quien, setQuien] = useState('');
  const [monto, setMonto] = useState('');
  const estadoCerrado = modo === 'cobrar' ? 'cobrado' : 'pagado';

  async function crear() {
    const body: Record<string, unknown> = { descripcion: desc, monto: Number(monto) };
    body[modo === 'cobrar' ? 'deudor' : 'acreedor'] = quien || undefined;
    await api(path, { method: 'POST', body });
    setDesc(''); setQuien(''); setMonto(''); setNuevo(false); recargar();
  }
  async function marcar(it: ItemCD) {
    await api(`${path}/${it.id}`, { method: 'PATCH', body: { estado: it.estado === 'pendiente' ? estadoCerrado : 'pendiente' } });
    recargar();
  }

  return (
    <>
      <div className="btn-row" style={{ marginBottom: '0.75rem' }}>
        <button className="btn-ghost" onClick={() => setNuevo((v) => !v)}><Icono name="plus" size={14} /> {modo === 'cobrar' ? 'Me deben' : 'Yo debo'}</button>
      </div>
      {nuevo && (
        <div className="card section-gap" style={{ marginTop: 0, marginBottom: '0.75rem' }}>
          <Field label="Descripción"><input value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
          <Field label={modo === 'cobrar' ? 'Deudor' : 'Acreedor'}><input value={quien} onChange={(e) => setQuien(e.target.value)} /></Field>
          <Field label="Monto (MXN)"><input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} /></Field>
          <button className="btn-primary" onClick={crear} disabled={!desc || !monto}>Guardar</button>
        </div>
      )}
      {cargando || !items ? <p className="muted">Cargando…</p> : items.length === 0 ? <Vacio texto="Nada por aquí." /> : (
        <div className="card">
          {items.map((it) => (
            <div key={it.id} className="row">
              <div className="row-main">
                <span className="row-title" style={it.estado !== 'pendiente' ? { textDecoration: 'line-through', color: 'var(--ink-3)' } : undefined}>{it.descripcion}</span>
                <span className="row-sub">{it.deudor ?? it.acreedor ?? ''} · {it.fecha}</span>
              </div>
              <span className="row-amount">{mxn(it.monto)}</span>
              <button className="pill" onClick={() => marcar(it)}>{it.estado === 'pendiente' ? 'Marcar' : '↩'}</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
