import { useEffect, useState } from 'react';
import { api, mxn } from '../api';
import { useAuth } from '../auth';
import { Page, useCargar, Field, Vacio, Modal } from '../ui';
import { Icono } from '../icons';
import { pushSoportado, permisoActual, estaSuscrito, activarPush, desactivarPush, probarPush } from '../push';

interface Cuenta { id: number; nombre: string; tipo_id: number; moneda: string; saldo_inicial: number; saldo: number }
interface Ref { tipos_cuenta: { id: number; nombre: string }[]; cuentas: Cuenta[]; categorias: { id: number; nombre: string; clase: string; area_id: number | null }[] }
interface Presupuesto { id: number; categoria_id: number | null; area_id: number | null; monto_limite: number }

export default function Configuracion() {
  return (
    <Page titulo="Configuración" icono="settings">
      <Perfil />
      <CuentasCfg />
      <CategoriasCfg />
      <PresupuestosCfg />
      <Ajustes />
      <Recordatorios />
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

function EditarCuenta({ cuenta, tipos, onClose, onSaved }: { cuenta: Cuenta; tipos: { id: number; nombre: string }[]; onClose: () => void; onSaved: () => void }) {
  const [nombre, setNombre] = useState(cuenta.nombre);
  const [tipo, setTipo] = useState<number>(cuenta.tipo_id);
  const [saldoInicial, setSaldoInicial] = useState(String(cuenta.saldo_inicial));
  const [error, setError] = useState('');
  async function guardar() {
    setError('');
    try {
      await api(`/finanzas/cuentas/${cuenta.id}`, { method: 'PATCH', body: { nombre, tipo_id: tipo, saldo_inicial: Number(saldoInicial) || 0 } });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  }
  return (
    <Modal titulo="Editar cuenta" onClose={onClose}>
      <Field label="Nombre"><input value={nombre} onChange={(e) => setNombre(e.target.value)} /></Field>
      <Field label="Tipo"><select value={tipo} onChange={(e) => setTipo(Number(e.target.value))}>{tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></Field>
      <Field label="Saldo inicial"><input type="number" inputMode="decimal" value={saldoInicial} onChange={(e) => setSaldoInicial(e.target.value)} /></Field>
      <p className="row-sub">Saldo actual (inicial + movimientos): <strong>{mxn(cuenta.saldo)}</strong></p>
      {error && <p className="error-msg">{error}</p>}
      <button className="btn-primary" onClick={guardar} disabled={!nombre}>Guardar</button>
    </Modal>
  );
}

function CuentasCfg() {
  const [ref, recargar] = useCargar<Ref>(() => api<Ref>('/finanzas/referencias'));
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<number | ''>('');
  const [saldo, setSaldo] = useState('');
  const [tipoNuevo, setTipoNuevo] = useState('');
  const [editar, setEditar] = useState<Cuenta | null>(null);
  async function crearCuenta() {
    await api('/finanzas/cuentas', { method: 'POST', body: { nombre, tipo_id: tipo || ref?.tipos_cuenta[0]?.id, saldo_inicial: Number(saldo) || 0 } });
    setNombre(''); setSaldo(''); recargar();
  }
  async function crearTipo() { await api('/finanzas/tipos-cuenta', { method: 'POST', body: { nombre: tipoNuevo } }); setTipoNuevo(''); recargar(); }
  return (
    <Seccion titulo="Cuentas">
      {(ref?.cuentas ?? []).map((c) => (
        <div key={c.id} className="row">
          <span className="row-title">{c.nombre}</span>
          <span className="row-amount">{mxn(c.saldo)}</span>
          <button className="icon-btn" onClick={() => setEditar(c)} aria-label="Editar cuenta"><Icono name="edit" size={15} /></button>
        </div>
      ))}
      {editar && ref && <EditarCuenta cuenta={editar} tipos={ref.tipos_cuenta} onClose={() => setEditar(null)} onSaved={() => { setEditar(null); recargar(); }} />}
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
  const [horaTareas, setHoraTareas] = useState('');
  async function guardar() {
    const body: Record<string, string> = {};
    if (cad) body.snapshot_cadencia_dias = cad;
    if (hora) body.peso_recordatorio_hora = hora;
    if (horaTareas) body.tareas_recordatorio_hora = horaTareas;
    await api('/settings', { method: 'PUT', body });
    setCad(''); setHora(''); setHoraTareas(''); recargar();
  }
  return (
    <Seccion titulo="Ajustes">
      <Field label={`Cadencia de snapshot de patrimonio (días) — actual: ${cfg?.snapshot_cadencia_dias ?? '7'}`}>
        <input type="number" value={cad} onChange={(e) => setCad(e.target.value)} placeholder={cfg?.snapshot_cadencia_dias ?? '7'} />
      </Field>
      <Field label={`Hora del recordatorio de peso — actual: ${cfg?.peso_recordatorio_hora ?? '07:30'}`}>
        <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
      </Field>
      <Field label={`Hora del resumen de tareas del día — actual: ${cfg?.tareas_recordatorio_hora ?? '08:00'}`}>
        <input type="time" value={horaTareas} onChange={(e) => setHoraTareas(e.target.value)} />
      </Field>
      <button className="btn-ghost" onClick={guardar}>Guardar ajustes</button>
    </Seccion>
  );
}

function Recordatorios() {
  const soportado = pushSoportado();
  const [permiso, setPermiso] = useState<NotificationPermission>(permisoActual());
  const [suscrito, setSuscrito] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (soportado) estaSuscrito().then(setSuscrito).catch(() => {});
  }, [soportado]);

  async function activar() {
    setOcupado(true); setError(''); setMsg('');
    try { await activarPush(); setSuscrito(true); setPermiso(permisoActual()); setMsg('Listo. Te llegarán recordatorios en este dispositivo.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'No pude activar los recordatorios.'); }
    finally { setOcupado(false); }
  }
  async function desactivar() {
    setOcupado(true); setError(''); setMsg('');
    try { await desactivarPush(); setSuscrito(false); setMsg('Recordatorios desactivados en este dispositivo.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error.'); }
    finally { setOcupado(false); }
  }
  async function probar() {
    setOcupado(true); setError(''); setMsg('');
    try { const n = await probarPush(); setMsg(n > 0 ? `Notificación de prueba enviada (${n} dispositivo${n > 1 ? 's' : ''}).` : 'No hay dispositivos suscritos todavía.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error al enviar la prueba.'); }
    finally { setOcupado(false); }
  }

  return (
    <Seccion titulo="Recordatorios">
      {!soportado ? (
        <p className="row-sub">Este navegador no soporta notificaciones push. En iPhone, primero instala Nodo Vida en la pantalla de inicio (Compartir → “Agregar a inicio”) y ábrela desde ahí.</p>
      ) : (
        <>
          <p className="row-sub" style={{ marginBottom: '0.6rem' }}>
            Avisos de peso, hábitos con hora y el resumen de tareas del día. Las horas se ajustan arriba, en <strong>Ajustes</strong>.
          </p>
          <div className="btn-row" style={{ alignItems: 'center' }}>
            {!suscrito ? (
              <button className="btn-primary" onClick={activar} disabled={ocupado}><Icono name="sparkles" size={15} /> Activar en este dispositivo</button>
            ) : (
              <>
                <span className="pill" style={{ color: 'var(--success)' }}>● Activos</span>
                <button className="btn-ghost" onClick={probar} disabled={ocupado}>Enviar prueba</button>
                <button className="btn-ghost" onClick={desactivar} disabled={ocupado}>Desactivar</button>
              </>
            )}
          </div>
          {permiso === 'denied' && <p className="row-sub" style={{ color: 'var(--danger)' }}>Bloqueaste las notificaciones para este sitio. Actívalas desde los ajustes del navegador.</p>}
          {msg && <p className="row-sub">{msg}</p>}
          {error && <p className="error-msg">{error}</p>}
        </>
      )}
    </Seccion>
  );
}

