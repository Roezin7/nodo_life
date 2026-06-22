import { useState } from 'react';
import { api, mxn } from '../api';
import { useAuth } from '../auth';
import { Page, useCargar, Field, Vacio } from '../ui';
import { Icono } from '../icons';

interface Area { id: number; nombre: string; color: string; icono: string; activo: boolean }
interface Cuenta { id: number; nombre: string; tipo_id: number; saldo: number }
interface Ref { tipos_cuenta: { id: number; nombre: string }[]; cuentas: Cuenta[]; categorias: { id: number; nombre: string; clase: string; area_id: number | null }[] }
interface Presupuesto { id: number; categoria_id: number | null; area_id: number | null; monto_limite: number }

export default function Configuracion() {
  return (
    <Page titulo="Configuración" icono="settings">
      <Perfil />
      <AreasCfg />
      <CuentasCfg />
      <CategoriasCfg />
      <PresupuestosCfg />
      <Ajustes />
      <Revisiones />
    </Page>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="card section-gap">
      <p className="card-title">{titulo}</p>
      {children}
    </div>
  );
}

function Perfil() {
  const { usuario, setNombre } = useAuth();
  const [nombre, setN] = useState(usuario?.nombre ?? '');
  const [pinA, setPinA] = useState('');
  const [pinN, setPinN] = useState('');
  const [msg, setMsg] = useState('');

  async function guardarNombre() {
    await api('/auth/nombre', { method: 'PATCH', body: { nombre } });
    setNombre(nombre); setMsg('Nombre actualizado.');
  }
  async function cambiarPin() {
    setMsg('');
    try {
      await api('/auth/cambiar-pin', { method: 'POST', body: { pin_actual: pinA, pin_nuevo: pinN } });
      setPinA(''); setPinN(''); setMsg('PIN actualizado.');
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Error'); }
  }
  return (
    <Seccion titulo="Perfil">
      <Field label="Nombre"><input value={nombre} onChange={(e) => setN(e.target.value)} /></Field>
      <button className="btn-ghost" onClick={guardarNombre}>Guardar nombre</button>
      <div className="btn-row" style={{ marginTop: '0.5rem' }}>
        <Field label="PIN actual"><input type="password" value={pinA} onChange={(e) => setPinA(e.target.value)} /></Field>
        <Field label="PIN nuevo"><input type="password" value={pinN} onChange={(e) => setPinN(e.target.value)} /></Field>
      </div>
      <button className="btn-ghost" onClick={cambiarPin} disabled={!pinA || !pinN}>Cambiar PIN</button>
      {msg && <p className="row-sub">{msg}</p>}
    </Seccion>
  );
}

function AreasCfg() {
  const [areas, recargar] = useCargar<Area[]>(() => api<Area[]>('/areas?todas=1'));
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState('#1F8EF1');
  async function crear() { await api('/areas', { method: 'POST', body: { nombre, color } }); setNombre(''); recargar(); }
  async function toggle(a: Area) { await api(`/areas/${a.id}`, { method: 'PATCH', body: { activo: !a.activo } }); recargar(); }
  return (
    <Seccion titulo="Áreas de vida">
      {(areas ?? []).map((a) => (
        <div key={a.id} className="row">
          <div className="area-chip"><span className="area-dot" style={{ background: a.color }} /> {a.nombre}</div>
          <button className="pill" onClick={() => toggle(a)}>{a.activo ? 'Activa' : 'Inactiva'}</button>
        </div>
      ))}
      <div className="btn-row" style={{ marginTop: '0.6rem', alignItems: 'flex-end' }}>
        <Field label="Nueva área"><input value={nombre} onChange={(e) => setNombre(e.target.value)} /></Field>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 44, height: 38, padding: 2 }} />
        <button className="btn-ghost" onClick={crear} disabled={!nombre}><Icono name="plus" size={14} /></button>
      </div>
    </Seccion>
  );
}

function CuentasCfg() {
  const [ref, recargar] = useCargar<Ref>(() => api<Ref>('/finanzas/referencias'));
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<number | ''>('');
  const [saldo, setSaldo] = useState('');
  const [tipoNuevo, setTipoNuevo] = useState('');
  async function crearCuenta() {
    await api('/finanzas/cuentas', { method: 'POST', body: { nombre, tipo_id: tipo || ref?.tipos_cuenta[0]?.id, saldo_inicial: Number(saldo) || 0 } });
    setNombre(''); setSaldo(''); recargar();
  }
  async function crearTipo() { await api('/finanzas/tipos-cuenta', { method: 'POST', body: { nombre: tipoNuevo } }); setTipoNuevo(''); recargar(); }
  return (
    <Seccion titulo="Cuentas">
      {(ref?.cuentas ?? []).map((c) => (
        <div key={c.id} className="row"><span className="row-title">{c.nombre}</span><span className="row-amount">{mxn(c.saldo)}</span></div>
      ))}
      <div className="btn-row" style={{ marginTop: '0.6rem', alignItems: 'flex-end' }}>
        <Field label="Cuenta nueva"><input value={nombre} onChange={(e) => setNombre(e.target.value)} /></Field>
        <Field label="Tipo"><select value={tipo} onChange={(e) => setTipo(Number(e.target.value))}>{(ref?.tipos_cuenta ?? []).map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></Field>
        <Field label="Saldo inicial"><input type="number" value={saldo} onChange={(e) => setSaldo(e.target.value)} /></Field>
        <button className="btn-ghost" onClick={crearCuenta} disabled={!nombre}><Icono name="plus" size={14} /></button>
      </div>
      <div className="btn-row" style={{ marginTop: '0.4rem', alignItems: 'flex-end' }}>
        <Field label="Nuevo tipo de cuenta"><input value={tipoNuevo} onChange={(e) => setTipoNuevo(e.target.value)} /></Field>
        <button className="btn-ghost" onClick={crearTipo} disabled={!tipoNuevo}><Icono name="plus" size={14} /></button>
      </div>
    </Seccion>
  );
}

function CategoriasCfg() {
  const [ref, recargar] = useCargar<Ref>(() => api<Ref>('/finanzas/referencias'));
  const [nombre, setNombre] = useState('');
  const [clase, setClase] = useState<'gasto' | 'ingreso'>('gasto');
  async function crear() { await api('/finanzas/categorias', { method: 'POST', body: { nombre, clase } }); setNombre(''); recargar(); }
  return (
    <Seccion titulo="Categorías">
      <div className="btn-row" style={{ flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
        {(ref?.categorias ?? []).map((c) => <span key={c.id} className="pill">{c.nombre} <span className="muted">{c.clase[0]}</span></span>)}
      </div>
      <div className="btn-row" style={{ alignItems: 'flex-end' }}>
        <Field label="Nueva categoría"><input value={nombre} onChange={(e) => setNombre(e.target.value)} /></Field>
        <Field label="Clase"><select value={clase} onChange={(e) => setClase(e.target.value as 'gasto' | 'ingreso')}><option value="gasto">Gasto</option><option value="ingreso">Ingreso</option></select></Field>
        <button className="btn-ghost" onClick={crear} disabled={!nombre}><Icono name="plus" size={14} /></button>
      </div>
    </Seccion>
  );
}

function PresupuestosCfg() {
  const [ps, recargar] = useCargar<Presupuesto[]>(() => api<Presupuesto[]>('/finanzas/presupuestos'));
  const [ref] = useCargar<Ref>(() => api<Ref>('/finanzas/referencias'));
  const [cat, setCat] = useState<number | ''>('');
  const [monto, setMonto] = useState('');
  const catNombre = (id: number | null) => ref?.categorias.find((c) => c.id === id)?.nombre ?? 'Área';
  async function crear() { await api('/finanzas/presupuestos', { method: 'POST', body: { categoria_id: cat || null, monto_limite: Number(monto) } }); setMonto(''); recargar(); }
  return (
    <Seccion titulo="Presupuestos (mensuales)">
      {(ps ?? []).length === 0 ? <Vacio texto="Sin presupuestos." /> : (ps ?? []).map((p) => (
        <div key={p.id} className="row"><span className="row-title">{catNombre(p.categoria_id)}</span><span className="row-amount">{mxn(p.monto_limite)}</span>
          <button className="icon-btn" onClick={async () => { await api(`/finanzas/presupuestos/${p.id}`, { method: 'DELETE' }); recargar(); }}><Icono name="trash" size={15} /></button>
        </div>
      ))}
      <div className="btn-row" style={{ marginTop: '0.6rem', alignItems: 'flex-end' }}>
        <Field label="Categoría"><select value={cat} onChange={(e) => setCat(Number(e.target.value))}><option value="">—</option>{(ref?.categorias ?? []).filter((c) => c.clase === 'gasto').map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Field>
        <Field label="Límite (MXN)"><input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} /></Field>
        <button className="btn-ghost" onClick={crear} disabled={!monto}><Icono name="plus" size={14} /></button>
      </div>
    </Seccion>
  );
}

function Ajustes() {
  const [cfg, recargar] = useCargar<Record<string, string>>(() => api('/settings'));
  const [cad, setCad] = useState('');
  const [hora, setHora] = useState('');
  async function guardar() {
    const body: Record<string, string> = {};
    if (cad) body.snapshot_cadencia_dias = cad;
    if (hora) body.peso_recordatorio_hora = hora;
    await api('/settings', { method: 'PUT', body });
    setCad(''); setHora(''); recargar();
  }
  return (
    <Seccion titulo="Ajustes">
      <Field label={`Cadencia de snapshot de patrimonio (días) — actual: ${cfg?.snapshot_cadencia_dias ?? '7'}`}>
        <input type="number" value={cad} onChange={(e) => setCad(e.target.value)} placeholder={cfg?.snapshot_cadencia_dias ?? '7'} />
      </Field>
      <Field label={`Hora del recordatorio de peso — actual: ${cfg?.peso_recordatorio_hora ?? '07:30'}`}>
        <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
      </Field>
      <button className="btn-ghost" onClick={guardar}>Guardar ajustes</button>
    </Seccion>
  );
}

interface Rev { id: number; tipo: string; fecha: string; notas: string | null }
function Revisiones() {
  const [revs, recargar] = useCargar<Rev[]>(() => api<Rev[]>('/revisiones'));
  const [notas, setNotas] = useState('');
  const [tipo, setTipo] = useState<'diaria' | 'semanal'>('diaria');
  const [msg, setMsg] = useState('');
  async function crear() {
    const r = await api<{ snapshot_generado: boolean }>('/revisiones', { method: 'POST', body: { tipo, notas: notas || undefined } });
    setNotas(''); setMsg(r.snapshot_generado ? 'Revisión guardada + snapshot de patrimonio generado.' : 'Revisión guardada.'); recargar();
  }
  return (
    <Seccion titulo="Revisiones (ritual diario / semanal)">
      <Field label="Tipo"><select value={tipo} onChange={(e) => setTipo(e.target.value as 'diaria' | 'semanal')}><option value="diaria">Diaria</option><option value="semanal">Semanal (dispara snapshots)</option></select></Field>
      <Field label="Notas"><textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} /></Field>
      <button className="btn-ghost" onClick={crear}>Guardar revisión</button>
      {msg && <p className="row-sub">{msg}</p>}
      <div className="section-gap">
        {(revs ?? []).slice(0, 8).map((r) => (
          <div key={r.id} className="row"><span className="row-title">{r.fecha} · {r.tipo}</span><span className="row-sub" style={{ flex: 1, textAlign: 'right' }}>{r.notas?.slice(0, 40)}</span></div>
        ))}
      </div>
    </Seccion>
  );
}
