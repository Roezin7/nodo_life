import { useState } from 'react';
import { api } from '../api';
import { Page, useCargar, Segmented, Field, Vacio, toast } from '../ui';
import { Icono } from '../icons';

interface Rev { id: number; tipo: string; fecha: string; notas: string | null; ia_resumen: { texto?: string } | null }

type Tipo = 'diaria' | 'semanal';

export default function Revisiones() {
  const [silvia] = useCargar<{ disponible: boolean }>(() => api('/silvia/estado'));
  const [revs, recargar, cargando] = useCargar<Rev[]>(() => api<Rev[]>('/revisiones'));
  const [tipo, setTipo] = useState<Tipo>('semanal');
  const [resumen, setResumen] = useState('');
  const [notas, setNotas] = useState('');
  const [generando, setGenerando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const silviaOk = silvia?.disponible;

  async function generar() {
    setGenerando(true); setError('');
    try {
      const r = await api<{ texto: string }>('/revisiones/resumen', { method: 'POST', body: { tipo } });
      setResumen(r.texto);
    } catch (e) { setError(e instanceof Error ? e.message : 'No pude generar el resumen.'); }
    finally { setGenerando(false); }
  }
  async function guardar() {
    setGuardando(true); setError('');
    try {
      const r = await api<{ snapshot_generado: boolean }>('/revisiones', {
        method: 'POST',
        body: { tipo, notas: notas || undefined, ia_resumen: resumen ? { texto: resumen } : undefined },
      });
      toast(r.snapshot_generado
        ? 'Cierre semanal guardado · patrimonio congelado y objetivos recalculados'
        : 'Revisión guardada');
      setResumen(''); setNotas(''); recargar();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al guardar.'); }
    finally { setGuardando(false); }
  }

  return (
    <Page titulo="Revisiones" icono="calendar">
      <p className="muted" style={{ marginTop: '-0.25rem', marginBottom: '0.9rem' }}>
        Tu ritual de cierre. La <strong>diaria</strong> define el foco del día; la <strong>semanal</strong> congela tu
        patrimonio, recalcula objetivos y deja a Silvia hacer balance de tus números.
      </p>

      <div className="card">
        <Segmented value={tipo} onChange={(v) => { setTipo(v); setResumen(''); setError(''); }}
          opciones={[{ v: 'semanal', label: 'Semanal' }, { v: 'diaria', label: 'Diaria' }]} />

        <div className="btn-row" style={{ marginTop: '0.8rem', alignItems: 'center' }}>
          {silviaOk ? (
            <button className="btn-primary" onClick={generar} disabled={generando}>
              <Icono name="sparkles" size={15} /> {generando ? 'Silvia está revisando…' : resumen ? 'Regenerar con Silvia' : 'Generar con Silvia'}
            </button>
          ) : (
            <span className="row-sub">Silvia no está configurada — puedes escribir la revisión a mano.</span>
          )}
        </div>

        {(resumen || silviaOk) && (
          <Field label="Resumen de Silvia (editable)">
            <textarea rows={resumen ? 10 : 4} value={resumen} onChange={(e) => setResumen(e.target.value)}
              placeholder={silviaOk ? 'Genera el resumen o escríbelo tú…' : 'Escribe tu balance…'} />
          </Field>
        )}
        <Field label="Tus notas (opcional)">
          <textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Lo que tú quieras anotar de este periodo…" />
        </Field>

        {tipo === 'semanal' && <p className="row-sub">Al guardar: se genera el snapshot de patrimonio y se recalcula el progreso de objetivos.</p>}
        <button className="btn-primary" style={{ marginTop: '0.5rem' }} onClick={guardar} disabled={guardando || (!resumen && !notas)}>
          {guardando ? 'Guardando…' : `Guardar revisión ${tipo}`}
        </button>
        {error && <p className="error-msg">{error}</p>}
      </div>

      <div className="section-gap">
        <p className="card-title" style={{ marginBottom: '0.5rem' }}>Historial</p>
        {cargando || !revs ? <p className="muted">Cargando…</p> : revs.length === 0 ? <Vacio texto="Sin revisiones aún. Cierra tu primera semana." /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {revs.map((r) => (
              <div key={r.id} className="card">
                <div className="row" style={{ borderBottom: 'none', paddingBottom: '0.3rem' }}>
                  <strong style={{ textTransform: 'capitalize' }}>{r.tipo}</strong>
                  <span className="row-sub">{r.fecha}</span>
                </div>
                {r.ia_resumen?.texto && <p style={{ whiteSpace: 'pre-wrap', margin: '0.25rem 0', fontSize: '0.9rem' }}>{r.ia_resumen.texto}</p>}
                {r.notas && <p className="row-sub" style={{ whiteSpace: 'pre-wrap' }}>📝 {r.notas}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Page>
  );
}
