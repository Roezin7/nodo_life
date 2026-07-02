import { useState } from 'react';
import { api, mxn } from '../api';
import { Page, useCargar, Stat, LineChart, Vacio, Modal, Field, confirmar, toast } from '../ui';
import { Icono } from '../icons';

interface ActivoFisico { id: number; nombre: string; categoria: 'inmueble' | 'vehiculo' | 'otro'; valor: number; nota: string | null; fecha_valuacion: string }
interface Vivo {
  fecha: string; total_activos: number; total_pasivos: number; patrimonio_neto: number;
  desglose: {
    cuentas: { cuenta_id: number; nombre: string; saldo: number }[]; inversiones_mxn: number; por_cobrar: number; deudas: number;
    activos_fisicos: number; activos_fisicos_detalle: { id: number; nombre: string; categoria: string; valor: number }[];
  };
  sugerir_snapshot: boolean; cadencia_dias: number;
}
interface Snap { id: number; fecha: string; patrimonio_neto: number; total_activos: number; total_pasivos: number }

const CAT_LABEL: Record<string, string> = { inmueble: 'Inmueble', vehiculo: 'Vehículo', otro: 'Otro' };

export default function Patrimonio() {
  const [vivo, recargarVivo, cargando] = useCargar<Vivo>(() => api<Vivo>('/patrimonio'));
  const [snaps, recargarSnaps] = useCargar<Snap[]>(() => api<Snap[]>('/patrimonio/snapshots'));
  const [activos, recargarActivos] = useCargar<ActivoFisico[]>(() => api<ActivoFisico[]>('/patrimonio/activos'));
  const [editar, setEditar] = useState<ActivoFisico | 'nuevo' | null>(null);

  async function snapshot() {
    await api('/patrimonio/snapshots', { method: 'POST', body: {} });
    recargarVivo(); recargarSnaps();
  }

  function trasGuardar() {
    setEditar(null);
    recargarActivos(); recargarVivo();
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
            <Stat label="Activos físicos" valor={mxn(vivo.desglose.activos_fisicos)} sub="no líquidos" />
          </div>

          <div className="card section-gap">
            <p className="card-title">Tendencia del patrimonio neto</p>
            {!snaps || snaps.length < 2 ? <Vacio texto="Captura snapshots para ver la tendencia." /> : (
              <LineChart points={snaps.map((s) => s.patrimonio_neto)} color="var(--success)" alto={140} />
            )}
          </div>

          <div className="card section-gap">
            <div className="row" style={{ alignItems: 'center' }}>
              <p className="card-title" style={{ margin: 0, flex: 1 }}>Activos físicos (no líquidos)</p>
              <button className="btn-ghost" onClick={() => setEditar('nuevo')}><Icono name="plus" size={14} /> Agregar</button>
            </div>
            <p className="row-sub" style={{ marginTop: -4 }}>Casa, carro, terreno… suman al patrimonio pero quedan fuera del flujo de efectivo.</p>
            {!activos || activos.length === 0 ? <Vacio texto="Sin activos físicos. Agrega tu casa, carro, etc." /> : activos.map((a) => (
              <div key={a.id} className="row">
                <div className="row-main">
                  <span className="row-title">{a.nombre} <span className="row-sub">{CAT_LABEL[a.categoria] ?? a.categoria}</span></span>
                  {a.nota && <span className="row-sub">{a.nota}</span>}
                </div>
                <span className="row-amount">{mxn(a.valor)}</span>
                <button className="icon-btn" onClick={() => setEditar(a)} aria-label="Editar"><Icono name="edit" size={15} /></button>
                <button className="icon-btn" onClick={async () => { if (await confirmar(`¿Borrar el activo "${a.nombre}"?`)) { await api(`/patrimonio/activos/${a.id}`, { method: 'DELETE' }); toast('Activo borrado'); recargarActivos(); recargarVivo(); } }}><Icono name="trash" size={15} /></button>
              </div>
            ))}
          </div>

          <div className="card section-gap">
            <p className="card-title">Desglose actual</p>
            {vivo.desglose.cuentas.map((c) => (
              <div key={c.cuenta_id} className="row"><span className="row-title">{c.nombre}</span><span className="row-amount">{mxn(c.saldo)}</span></div>
            ))}
            <div className="row"><span className="row-title">Inversiones (a mercado)</span><span className="row-amount">{mxn(vivo.desglose.inversiones_mxn)}</span></div>
            <div className="row"><span className="row-title">Activos físicos (no líquidos)</span><span className="row-amount">{mxn(vivo.desglose.activos_fisicos)}</span></div>
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
                  <button className="icon-btn" onClick={async () => { if (await confirmar(`¿Borrar el snapshot del ${s.fecha}?`)) { await api(`/patrimonio/snapshots/${s.id}`, { method: 'DELETE' }); toast('Snapshot borrado'); recargarSnaps(); } }}><Icono name="trash" size={15} /></button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {editar && <ActivoModal activo={editar === 'nuevo' ? null : editar} onClose={() => setEditar(null)} onSaved={trasGuardar} />}
    </Page>
  );
}

function ActivoModal({ activo, onClose, onSaved }: { activo: ActivoFisico | null; onClose: () => void; onSaved: () => void }) {
  const [nombre, setNombre] = useState(activo?.nombre ?? '');
  const [categoria, setCategoria] = useState<'inmueble' | 'vehiculo' | 'otro'>(activo?.categoria ?? 'inmueble');
  const [valor, setValor] = useState(activo ? String(activo.valor) : '');
  const [nota, setNota] = useState(activo?.nota ?? '');
  const [fecha, setFecha] = useState(activo?.fecha_valuacion ?? new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');

  async function guardar() {
    setError('');
    const body = { nombre, categoria, valor: Number(valor), nota: nota || undefined, fecha_valuacion: fecha };
    try {
      if (activo) await api(`/patrimonio/activos/${activo.id}`, { method: 'PATCH', body });
      else await api('/patrimonio/activos', { method: 'POST', body });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  }

  return (
    <Modal titulo={activo ? 'Editar activo físico' : 'Nuevo activo físico'} onClose={onClose}>
      <Field label="Nombre"><input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Casa, Mazda 3, terreno…" /></Field>
      <Field label="Categoría">
        <select value={categoria} onChange={(e) => setCategoria(e.target.value as 'inmueble' | 'vehiculo' | 'otro')}>
          <option value="inmueble">Inmueble</option>
          <option value="vehiculo">Vehículo</option>
          <option value="otro">Otro</option>
        </select>
      </Field>
      <Field label="Valor estimado (MXN)"><input type="number" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="p.ej. 350000" /></Field>
      <Field label="Fecha de valuación"><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
      <Field label="Nota (opcional)"><input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="modelo, ubicación…" /></Field>
      {error && <p className="error-msg">{error}</p>}
      <button className="btn-primary" onClick={guardar} disabled={!nombre || !valor}>Guardar</button>
    </Modal>
  );
}
