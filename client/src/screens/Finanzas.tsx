import { useState } from 'react';
import { api, mxn, pct } from '../api';
import { Page, useCargar, Stat, Progress, Modal, Field, Segmented, Vacio } from '../ui';
import { Icono } from '../icons';

interface Cuenta { id: number; nombre: string; tipo_id: number; moneda: string; es_central: boolean; saldo: number }
interface Categoria { id: number; nombre: string; clase: 'ingreso' | 'gasto'; area_id: number | null }
interface Ref { tipos_cuenta: { id: number; nombre: string }[]; cuentas: Cuenta[]; categorias: Categoria[] }
interface Mov { id: number; fecha: string; tipo: string; monto: number; cuenta_origen_id: number | null; cuenta_destino_id: number | null; categoria_id: number | null; area_id: number | null; descripcion: string | null }
interface Dash {
  mes: string;
  resumen: { ingresos: number; gastos: number; flujo: number; tasa_ahorro: number };
  saldos: { cuenta_id: number; nombre: string; saldo: number }[];
  total_liquido: number; por_cobrar: number; deudas: number; inversiones: number; patrimonio_liquido: number; capital_proyectado: number;
  gasto_por_categoria: { categoria_id: number; nombre: string; monto: number }[];
  presupuestos: { id: number; etiqueta: string; gastado: number; limite: number; ratio: number; nivel: string }[];
}

const hoyMes = () => new Date().toISOString().slice(0, 7);
const hoyDia = () => new Date().toISOString().slice(0, 10);
type Tab = 'resumen' | 'movimientos' | 'cobrar' | 'deudas';
type Periodo = 'mes' | 'semana';

/** Lunes (YYYY-MM-DD) de la semana del día dado. */
function lunesISO(dia: string): string {
  const dt = new Date(dia + 'T00:00:00Z');
  const dow = dt.getUTCDay();
  dt.setUTCDate(dt.getUTCDate() + ((dow === 0 ? -6 : 1) - dow));
  return dt.toISOString().slice(0, 10);
}

interface NavProps { periodo: Periodo; cursor: string; setCursor: (c: string) => void; setPeriodo: (p: Periodo) => void }

export default function Finanzas() {
  const [tab, setTab] = useState<Tab>('resumen');
  const [periodo, setPeriodoState] = useState<Periodo>('mes');
  const [cursor, setCursor] = useState(hoyMes());
  const [ref, recargarRef] = useCargar<Ref>(() => api<Ref>('/finanzas/referencias'));
  const [nuevo, setNuevo] = useState(false);

  // Al cambiar de periodo reposicionamos el cursor (mes actual / semana actual).
  const setPeriodo = (p: Periodo) => { setPeriodoState(p); setCursor(p === 'mes' ? hoyMes() : hoyDia()); };
  const nav: NavProps = { periodo, cursor, setCursor, setPeriodo };

  return (
    <Page titulo="Dinero" icono="wallet" accion={<button className="btn-primary" onClick={() => setNuevo(true)}><Icono name="plus" size={16} /> Movimiento</button>}>
      <Segmented value={tab} onChange={setTab} opciones={[
        { v: 'resumen', label: 'Resumen' },
        { v: 'movimientos', label: 'Movimientos' },
        { v: 'cobrar', label: 'Por cobrar' },
        { v: 'deudas', label: 'Deudas' },
      ]} />
      <div className="section-gap">
        {tab === 'resumen' && <Resumen nav={nav} />}
        {tab === 'movimientos' && ref && <Movimientos nav={nav} ref_={ref} />}
        {tab === 'cobrar' && <CobrarDeudas modo="cobrar" />}
        {tab === 'deudas' && <CobrarDeudas modo="deudas" />}
      </div>
      {nuevo && ref && <MovimientoForm ref_={ref} onClose={() => setNuevo(false)} onSaved={() => { setNuevo(false); recargarRef(); }} />}
    </Page>
  );
}

function PeriodoNav({ periodo, cursor, setCursor, setPeriodo }: NavProps) {
  const shift = (n: number) => {
    if (periodo === 'mes') {
      const d = new Date(cursor + '-01T00:00:00Z');
      d.setUTCMonth(d.getUTCMonth() + n);
      setCursor(d.toISOString().slice(0, 7));
    } else {
      const d = new Date(cursor + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + n * 7);
      setCursor(d.toISOString().slice(0, 10));
    }
  };
  const etiqueta = periodo === 'mes' ? cursor : `Semana del ${lunesISO(cursor)}`;
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <Segmented value={periodo} onChange={setPeriodo} opciones={[{ v: 'mes', label: 'Mes' }, { v: 'semana', label: 'Semana' }]} />
      <div className="btn-row" style={{ alignItems: 'center', marginTop: '0.5rem' }}>
        <button className="pill" onClick={() => shift(-1)}><Icono name="back" size={14} /></button>
        <strong style={{ fontFamily: 'var(--font-mono)' }}>{etiqueta}</strong>
        <button className="pill" onClick={() => shift(1)}><Icono name="chevron" size={14} /></button>
      </div>
    </div>
  );
}

function Resumen({ nav }: { nav: NavProps }) {
  const [d, , cargando] = useCargar<Dash>(() => api<Dash>(`/finanzas/dashboard?periodo=${nav.periodo}&ref=${nav.cursor}`), [nav.periodo, nav.cursor]);
  return (
    <>
      <PeriodoNav {...nav} />
      {cargando || !d ? <p className="muted">Cargando…</p> : <ResumenBody d={d} />}
    </>
  );
}

function ResumenBody({ d }: { d: Dash }) {
  return (
    <>
      <div className="stat-grid">
        <Stat label="Ingresos" valor={mxn(d.resumen.ingresos)} color="var(--success)" />
        <Stat label="Gastos" valor={mxn(d.resumen.gastos)} color="var(--danger)" />
        <Stat label="Flujo" valor={mxn(d.resumen.flujo)} />
        <Stat label="Tasa de ahorro" valor={pct(d.resumen.tasa_ahorro)} />
        <Stat label="Líquido total" valor={mxn(d.total_liquido)} />
        <Stat label="Patrimonio líquido" valor={mxn(d.patrimonio_liquido)} sub={`+ inversiones en Patrimonio`} />
        <Stat label="Capital proyectado" valor={mxn(d.capital_proyectado)} sub={`Efectivo + por cobrar − deudas + inversiones ${mxn(d.inversiones)}`} color="var(--success)" />
      </div>

      <div className="card section-gap">
        <p className="card-title">Saldos por cuenta</p>
        {d.saldos.map((s) => (
          <div key={s.cuenta_id} className="row"><span className="row-title">{s.nombre}</span><span className="row-amount">{mxn(s.saldo)}</span></div>
        ))}
      </div>

      {d.gasto_por_categoria.filter((c) => c.monto > 0).length > 0 && (
        <div className="card section-gap">
          <p className="card-title">Gasto por categoría</p>
          {d.gasto_por_categoria.filter((c) => c.monto > 0).map((c) => (
            <div key={c.categoria_id} className="row"><span className="row-title">{c.nombre}</span><span className="row-amount">{mxn(c.monto)}</span></div>
          ))}
        </div>
      )}

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

function Movimientos({ nav, ref_ }: { nav: NavProps; ref_: Ref }) {
  const [movs, recargar, cargando] = useCargar<Mov[]>(() => api<Mov[]>(`/finanzas/movimientos?periodo=${nav.periodo}&ref=${nav.cursor}`), [nav.periodo, nav.cursor]);
  const [editar, setEditar] = useState<Mov | null>(null);
  const cuentaNombre = (id: number | null) => ref_.cuentas.find((c) => c.id === id)?.nombre ?? '';
  const catNombre = (id: number | null) => ref_.categorias.find((c) => c.id === id)?.nombre ?? '';

  async function borrar(id: number) {
    if (!confirm('¿Borrar movimiento?')) return;
    await api(`/finanzas/movimientos/${id}`, { method: 'DELETE' });
    recargar();
  }

  return (
    <>
      <PeriodoNav {...nav} />
      {cargando || !movs ? <p className="muted">Cargando…</p> : movs.length === 0 ? <Vacio texto="Sin movimientos en este periodo." /> : (
        <div className="card">
          {movs.map((m) => {
            const signo = m.tipo === 'ingreso' ? '+' : m.tipo === 'gasto' ? '−' : '';
            return (
              <div key={m.id} className="row">
                <div className="row-main">
                  <span className="row-title">{m.descripcion || catNombre(m.categoria_id) || m.tipo}</span>
                  <span className="row-sub">
                    {m.fecha} · {m.tipo === 'transferencia' ? `${cuentaNombre(m.cuenta_origen_id)} → ${cuentaNombre(m.cuenta_destino_id)}` : cuentaNombre(m.cuenta_origen_id ?? m.cuenta_destino_id)}
                  </span>
                </div>
                <span className={`row-amount ${m.tipo === 'ingreso' ? 'pos' : m.tipo === 'gasto' ? 'neg' : ''}`}>{signo}{mxn(m.monto)}</span>
                <button className="icon-btn" onClick={() => setEditar(m)} aria-label="Editar"><Icono name="edit" size={15} /></button>
                <button className="icon-btn" onClick={() => borrar(m.id)} aria-label="Borrar"><Icono name="trash" size={15} /></button>
              </div>
            );
          })}
        </div>
      )}
      {editar && <MovimientoForm ref_={ref_} mov={editar} onClose={() => setEditar(null)} onSaved={() => { setEditar(null); recargar(); }} />}
    </>
  );
}

function MovimientoForm({ ref_, mov, onClose, onSaved }: { ref_: Ref; mov?: Mov; onClose: () => void; onSaved: () => void }) {
  const [tipo, setTipo] = useState<'gasto' | 'ingreso' | 'transferencia'>((mov?.tipo as 'gasto' | 'ingreso' | 'transferencia') ?? 'gasto');
  const [monto, setMonto] = useState(mov ? String(mov.monto) : '');
  const [fecha, setFecha] = useState(mov?.fecha ?? hoyDia());
  const [origen, setOrigen] = useState<number | ''>(mov?.cuenta_origen_id ?? ref_.cuentas[0]?.id ?? '');
  const [destino, setDestino] = useState<number | ''>(mov?.cuenta_destino_id ?? ref_.cuentas[0]?.id ?? '');
  const [categoria, setCategoria] = useState<number | ''>(mov?.categoria_id ?? '');
  const [desc, setDesc] = useState(mov?.descripcion ?? '');
  const [error, setError] = useState('');
  const cats = ref_.categorias.filter((c) => c.clase === (tipo === 'ingreso' ? 'ingreso' : 'gasto'));

  async function guardar() {
    setError('');
    try {
      const body = {
        tipo, monto: Number(monto), fecha,
        cuenta_origen_id: tipo !== 'ingreso' ? origen || null : null,
        cuenta_destino_id: tipo !== 'gasto' ? destino || null : null,
        categoria_id: tipo !== 'transferencia' ? (categoria || null) : null,
        area_id: mov?.area_id ?? undefined,
        descripcion: desc || undefined,
      };
      if (mov) await api(`/finanzas/movimientos/${mov.id}`, { method: 'PATCH', body });
      else await api('/finanzas/movimientos', { method: 'POST', body });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  }

  return (
    <Modal titulo={mov ? 'Editar movimiento' : 'Nuevo movimiento'} onClose={onClose}>
      <Segmented value={tipo} onChange={setTipo} opciones={[{ v: 'gasto', label: 'Gasto' }, { v: 'ingreso', label: 'Ingreso' }, { v: 'transferencia', label: 'Transferencia' }]} />
      <Field label="Monto (MXN)"><input type="number" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" /></Field>
      <Field label="Fecha"><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
      {tipo !== 'ingreso' && (
        <Field label="Cuenta origen"><select value={origen} onChange={(e) => setOrigen(Number(e.target.value))}>{ref_.cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Field>
      )}
      {tipo !== 'gasto' && (
        <Field label="Cuenta destino"><select value={destino} onChange={(e) => setDestino(Number(e.target.value))}>{ref_.cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Field>
      )}
      {tipo !== 'transferencia' && (
        <Field label="Categoría"><select value={categoria} onChange={(e) => setCategoria(Number(e.target.value))}><option value="">—</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Field>
      )}
      <Field label="Descripción"><input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="opcional" /></Field>
      {error && <p className="error-msg">{error}</p>}
      <button className="btn-primary" onClick={guardar} disabled={!monto}>Guardar</button>
    </Modal>
  );
}

interface ItemCD { id: number; descripcion: string; deudor?: string; acreedor?: string; monto: number; fecha: string; estado: string }
function CobrarDeudas({ modo }: { modo: 'cobrar' | 'deudas' }) {
  const path = modo === 'cobrar' ? '/finanzas/por-cobrar' : '/finanzas/deudas';
  const [items, recargar, cargando] = useCargar<ItemCD[]>(() => api<ItemCD[]>(path), [modo]);
  const [nuevo, setNuevo] = useState(false);
  const [editar, setEditar] = useState<ItemCD | null>(null);
  const [desc, setDesc] = useState('');
  const [quien, setQuien] = useState('');
  const [monto, setMonto] = useState('');
  const estadoCerrado = modo === 'cobrar' ? 'cobrado' : 'pagado';

  async function borrar(it: ItemCD) {
    if (!confirm(`¿Borrar "${it.descripcion}"?`)) return;
    await api(`${path}/${it.id}`, { method: 'DELETE' });
    recargar();
  }

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
              <button className="pill" style={{ minWidth: '5rem' }} onClick={() => marcar(it)}>{it.estado === 'pendiente' ? 'Marcar' : '↩'}</button>
              <button className="icon-btn" onClick={() => setEditar(it)} aria-label="Editar"><Icono name="edit" size={15} /></button>
              <button className="icon-btn" onClick={() => borrar(it)} aria-label="Borrar"><Icono name="trash" size={15} /></button>
            </div>
          ))}
        </div>
      )}
      {editar && <EditarCD modo={modo} path={path} item={editar} onClose={() => setEditar(null)} onSaved={() => { setEditar(null); recargar(); }} />}
    </>
  );
}

function EditarCD({ modo, path, item, onClose, onSaved }: { modo: 'cobrar' | 'deudas'; path: string; item: ItemCD; onClose: () => void; onSaved: () => void }) {
  const [desc, setDesc] = useState(item.descripcion);
  const [quien, setQuien] = useState(item.deudor ?? item.acreedor ?? '');
  const [monto, setMonto] = useState(String(item.monto));
  const [fecha, setFecha] = useState(item.fecha);
  const [error, setError] = useState('');

  async function guardar() {
    setError('');
    try {
      const body: Record<string, unknown> = { descripcion: desc, monto: Number(monto), fecha };
      body[modo === 'cobrar' ? 'deudor' : 'acreedor'] = quien || null;
      await api(`${path}/${item.id}`, { method: 'PATCH', body });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  }

  return (
    <Modal titulo={modo === 'cobrar' ? 'Editar por cobrar' : 'Editar deuda'} onClose={onClose}>
      <Field label="Descripción"><input value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
      <Field label={modo === 'cobrar' ? 'Deudor' : 'Acreedor'}><input value={quien} onChange={(e) => setQuien(e.target.value)} /></Field>
      <Field label="Monto (MXN)"><input type="number" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} /></Field>
      <Field label="Fecha"><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
      {error && <p className="error-msg">{error}</p>}
      <button className="btn-primary" onClick={guardar} disabled={!desc || !monto}>Guardar</button>
    </Modal>
  );
}
