import { useState } from 'react';
import { api } from '../api';
import { Page, useCargar, Stat, Segmented, Modal, Field, Vacio, LineChart, confirmar, toast } from '../ui';
import { Icono } from '../icons';

interface PesoPunto { fecha: string; peso: number; media_movil: number }
interface PesoData { serie: PesoPunto[]; ultimo: { fecha: string; peso: number } | null; variacion_periodo: number | null }
interface Tipo { id: number; nombre: string }
interface Serie { id: number; ejercicio: string; series: number | null; reps: number | null; peso: number | null }
interface Ent { id: number; fecha: string; tipo_id: number; tipo_nombre: string; duracion_min: number | null; notas: string | null; metricas: Record<string, number> | null; series: Serie[] }
interface DiaCal { fecha: string; entrenado: boolean; tipos: string[] }
interface Calendario { mes: string; dias: DiaCal[]; offset_inicial: number; total_entrenados: number }

const DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const hoyMes = () => new Date().toISOString().slice(0, 7);

export default function Salud() {
  const [tab, setTab] = useState<'peso' | 'entrenamientos'>('peso');
  return (
    <Page titulo="Salud" icono="heart">
      <Segmented value={tab} onChange={setTab} opciones={[{ v: 'peso', label: 'Peso' }, { v: 'entrenamientos', label: 'Entrenamientos' }]} />
      <div className="section-gap">{tab === 'peso' ? <Peso /> : <Entrenamientos />}</div>
    </Page>
  );
}

function Peso() {
  const [d, recargar, cargando] = useCargar<PesoData>(() => api<PesoData>('/salud/peso'));
  const [valor, setValor] = useState('');
  async function registrar() {
    if (!valor) return;
    await api('/salud/peso', { method: 'POST', body: { peso: Number(valor) } });
    setValor(''); recargar();
  }
  return (
    <>
      <div className="captura-bar">
        <input type="number" inputMode="decimal" placeholder="Peso de hoy (kg)" value={valor} onChange={(e) => setValor(e.target.value)} />
        <button className="btn-primary" onClick={registrar}>Registrar</button>
      </div>
      {cargando || !d ? <p className="muted">Cargando…</p> : (
        <>
          <div className="stat-grid">
            <Stat label="Último" valor={d.ultimo ? `${d.ultimo.peso} kg` : '—'} sub={d.ultimo?.fecha} />
            <Stat label="Variación periodo" valor={d.variacion_periodo != null ? `${d.variacion_periodo > 0 ? '+' : ''}${d.variacion_periodo} kg` : '—'} color={d.variacion_periodo != null && d.variacion_periodo <= 0 ? 'var(--success)' : 'var(--danger)'} />
          </div>
          <div className="card section-gap">
            <p className="card-title">Tendencia (media móvil 7 días)</p>
            <LineChart points={d.serie.map((p) => p.peso)} segunda={d.serie.map((p) => p.media_movil)} color="var(--data-azulejo)" alto={150} />
          </div>
        </>
      )}
    </>
  );
}

function CalendarioEntrenos({ refresco }: { refresco: number }) {
  const [mes, setMes] = useState(hoyMes());
  const [cal, , cargando] = useCargar<Calendario>(() => api<Calendario>(`/salud/calendario?mes=${mes}`), [mes, refresco]);
  const shift = (n: number) => {
    const d = new Date(mes + '-01T00:00:00Z');
    d.setUTCMonth(d.getUTCMonth() + n);
    setMes(d.toISOString().slice(0, 7));
  };
  return (
    <div className="card section-gap">
      <div className="row" style={{ borderBottom: 'none', paddingBottom: '0.3rem', alignItems: 'center' }}>
        <p className="card-title" style={{ margin: 0 }}>Mapa del mes</p>
        <div className="btn-row" style={{ alignItems: 'center', marginLeft: 'auto' }}>
          <button className="pill" onClick={() => shift(-1)}><Icono name="back" size={14} /></button>
          <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{mes}</strong>
          <button className="pill" onClick={() => shift(1)}><Icono name="chevron" size={14} /></button>
        </div>
      </div>
      {cargando || !cal ? <p className="muted">Cargando…</p> : (
        <>
          <div className="month-grid">
            {DOW.map((d, i) => <span key={i} className="month-dow">{d}</span>)}
            {Array.from({ length: cal.offset_inicial }).map((_, i) => <span key={`e${i}`} />)}
            {cal.dias.map((dia) => (
              <span key={dia.fecha} className={`habit-day ${dia.entrenado ? 'habit-day--on' : ''}`} title={`${dia.fecha}${dia.tipos.length ? ' · ' + dia.tipos.join(', ') : ''}`}>
                {Number(dia.fecha.slice(8))}
              </span>
            ))}
          </div>
          <p className="row-sub" style={{ marginTop: '0.5rem' }}>{cal.total_entrenados} días entrenados este mes</p>
        </>
      )}
    </div>
  );
}

function Entrenamientos() {
  const [tipos] = useCargar<Tipo[]>(() => api<Tipo[]>('/salud/tipos'));
  const [tipoSel, setTipoSel] = useState<number | null>(null);
  const tipoId = tipoSel ?? tipos?.[0]?.id ?? null;
  const [ents, recargar, cargando] = useCargar<Ent[]>(() => tipoId ? api<Ent[]>(`/salud/entrenamientos?tipo_id=${tipoId}`) : Promise.resolve([]), [tipoId]);
  const [nuevo, setNuevo] = useState(false);
  const [refrescoCal, setRefrescoCal] = useState(0);
  const tipoNombre = tipos?.find((t) => t.id === tipoId)?.nombre ?? '';

  return (
    <>
      <CalendarioEntrenos refresco={refrescoCal} />
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <Segmented value={String(tipoId ?? '')} onChange={(v) => setTipoSel(Number(v))} opciones={(tipos ?? []).map((t) => ({ v: String(t.id), label: t.nombre }))} />
        <button className="btn-primary" onClick={() => setNuevo(true)} disabled={!tipoId}><Icono name="plus" size={16} /> Registrar</button>
      </div>
      {cargando || !ents ? <p className="muted" style={{ marginTop: '1rem' }}>Cargando…</p> : ents.length === 0 ? <div className="section-gap"><Vacio texto={`Sin ${tipoNombre.toLowerCase()} registrados.`} /></div> : (
        <div className="card section-gap">
          {ents.map((e) => (
            <div key={e.id} className="row">
              <div className="row-main">
                <span className="row-title">{e.fecha} {e.duracion_min ? `· ${e.duracion_min} min` : ''}</span>
                <span className="row-sub">
                  {e.series.length > 0 ? e.series.map((s) => `${s.ejercicio} ${s.series ?? ''}×${s.reps ?? ''}${s.peso ? ` @${s.peso}kg` : ''}`).join(' · ')
                    : e.metricas ? Object.entries(e.metricas).map(([k, v]) => `${k}: ${v}`).join(' · ') : (e.notas ?? '')}
                </span>
              </div>
              <button className="icon-btn" onClick={async () => { if (await confirmar(`¿Borrar el entrenamiento del ${e.fecha}?`)) { await api(`/salud/entrenamientos/${e.id}`, { method: 'DELETE' }); toast('Entrenamiento borrado'); recargar(); } }}><Icono name="trash" size={15} /></button>
            </div>
          ))}
        </div>
      )}
      {nuevo && tipoId && <NuevoEntrenamiento tipoId={tipoId} tipoNombre={tipoNombre} onClose={() => setNuevo(false)} onSaved={() => { setNuevo(false); recargar(); setRefrescoCal((n) => n + 1); }} />}
    </>
  );
}

function NuevoEntrenamiento({ tipoId, tipoNombre, onClose, onSaved }: { tipoId: number; tipoNombre: string; onClose: () => void; onSaved: () => void }) {
  const esPesas = /pesas/i.test(tipoNombre);
  const esCorrer = /correr|run/i.test(tipoNombre);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [duracion, setDuracion] = useState('');
  const [notas, setNotas] = useState('');
  const [series, setSeries] = useState<{ ejercicio: string; series: string; reps: string; peso: string }[]>([{ ejercicio: '', series: '', reps: '', peso: '' }]);
  const [metricas, setMetricas] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const camposMetrica = esCorrer ? ['distancia_km', 'fc_promedio'] : /hiit/i.test(tipoNombre) ? ['rondas', 'trabajo_seg', 'descanso_seg', 'intensidad'] : ['valor'];

  async function guardar() {
    setError('');
    try {
      const body: Record<string, unknown> = { tipo_id: tipoId, fecha: fecha || undefined, duracion_min: duracion ? Number(duracion) : undefined, notas: notas || undefined };
      if (esPesas) {
        body.series = series.filter((s) => s.ejercicio).map((s) => ({ ejercicio: s.ejercicio, series: s.series ? Number(s.series) : undefined, reps: s.reps ? Number(s.reps) : undefined, peso: s.peso ? Number(s.peso) : undefined }));
      } else {
        const m: Record<string, number> = {};
        for (const [k, v] of Object.entries(metricas)) if (v) m[k] = Number(v);
        body.metricas = m;
      }
      await api('/salud/entrenamientos', { method: 'POST', body });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  }

  return (
    <Modal titulo={`Registrar ${tipoNombre}`} onClose={onClose}>
      <Field label="Fecha"><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
      <Field label="Duración (min)"><input type="number" value={duracion} onChange={(e) => setDuracion(e.target.value)} /></Field>
      {esPesas ? (
        <>
          <span className="field-label">Ejercicios</span>
          {series.map((s, i) => (
            <div key={i} className="btn-row" style={{ flexWrap: 'nowrap' }}>
              <input placeholder="Ejercicio" value={s.ejercicio} onChange={(e) => setSeries(series.map((x, j) => j === i ? { ...x, ejercicio: e.target.value } : x))} />
              <input style={{ width: 56 }} placeholder="Ser" value={s.series} onChange={(e) => setSeries(series.map((x, j) => j === i ? { ...x, series: e.target.value } : x))} />
              <input style={{ width: 56 }} placeholder="Rep" value={s.reps} onChange={(e) => setSeries(series.map((x, j) => j === i ? { ...x, reps: e.target.value } : x))} />
              <input style={{ width: 64 }} placeholder="kg" value={s.peso} onChange={(e) => setSeries(series.map((x, j) => j === i ? { ...x, peso: e.target.value } : x))} />
            </div>
          ))}
          <button className="btn-ghost" onClick={() => setSeries([...series, { ejercicio: '', series: '', reps: '', peso: '' }])}>+ Ejercicio</button>
        </>
      ) : (
        camposMetrica.map((c) => (
          <Field key={c} label={c.replace(/_/g, ' ')}><input type="number" inputMode="decimal" value={metricas[c] ?? ''} onChange={(e) => setMetricas({ ...metricas, [c]: e.target.value })} /></Field>
        ))
      )}
      <Field label="Notas"><input value={notas} onChange={(e) => setNotas(e.target.value)} /></Field>
      {error && <p className="error-msg">{error}</p>}
      <button className="btn-primary" onClick={guardar}>Guardar</button>
    </Modal>
  );
}
