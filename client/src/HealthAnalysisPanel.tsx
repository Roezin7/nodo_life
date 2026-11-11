export default function HealthAnalysisPanel({ data: d }: { data: any }) {
  const w = d.weight;
  const points = w.observations;
  const low = Math.min(...points.map((x: any) => x.kg));
  const high = Math.max(...points.map((x: any) => x.kg));
  const completeDays = d.nutrition.complete_days;
  return (
    <section className="card n-card" aria-label="Análisis de salud">
      <div className="section-head"><div>
        <small>ÚLTIMOS {d.window_days} DÍAS · HASTA {d.as_of}</small>
        <h2>Tu salud, con perspectiva</h2>
      </div></div>
      <div className="kpi-grid">
        <div><small>Peso medio</small><h3>{w.mean_kg == null ? 'Sin datos suficientes' : `${w.mean_kg} kg`}</h3><p>{w.measured_days} fechas con medición</p></div>
        <div><small>Días de alimentación completos</small><h3>{completeDays} / {d.window_days}</h3><p>Confirmados por ti</p></div>
        <div><small>Días con actividad registrada</small><h3>{d.days.filter((x: any) => x.workouts.length).length}</h3><p>Entrenamiento o deporte</p></div>
      </div>
      {points.length > 0 && <figure style={{ margin: '20px 0' }}>
        <svg viewBox="0 0 600 120" role="img" aria-label="Peso por fecha, sin rellenar días ausentes" style={{ width: '100%', maxHeight: 180 }}>
          {points.map((p: any) => {
            const x = 25 + (Date.parse(p.date) - Date.parse(d.start)) / 86400000 / Math.max(d.window_days - 1, 1) * 550;
            const y = 95 - (p.kg - low) / Math.max(high - low, 1) * 65;
            return <g key={p.date}><circle cx={x} cy={y} r="5" fill="currentColor" /><title>{p.date}: {p.kg} kg</title><text x={x} y={y - 12} textAnchor="middle" fill="currentColor" fontSize="12">{p.kg}</text></g>;
          })}
        </svg>
        <figcaption>{d.start} — {d.as_of}</figcaption>
      </figure>}
      <h3>Tu siguiente paso</h3>
      <p>{completeDays === 0 ? 'Confirma un día completo de alimentación para empezar a comparar tu ingesta.' : 'Sigue completando tus registros para comparar tus hábitos.'}</p>
      <p className="data-caption">{completeDays === 0 ? 'Con datos parciales aún no podemos estimar tu déficit.' : 'Los promedios usan días completos y los valores conocidos de cada nutriente.'}</p>
      {completeDays > 0 && <div className="kpi-grid">{Object.entries(d.nutrition.complete_day_averages).map(([key, value]) => {
        const v = value as any;
        return <div key={key}><small>{({ kcal: 'Energía', protein_g: 'Proteína', carbs_g: 'Carbohidratos', fat_g: 'Grasas' } as any)[key]}</small><p><strong>{v.mean == null ? 'Sin datos suficientes' : `${v.mean} ${key === 'kcal' ? 'kcal' : 'g'}`}</strong> · {v.days} días comparables</p></div>;
      })}</div>}
      <details className="context-details">
        <summary>Cómo leer este análisis</summary>
        <div className="context-details-body">
          <p>El peso medio usa {w.measured_days} fechas medidas; {w.missing_days} días no tienen medición. La variación diaria de peso no demuestra un cambio de grasa.</p>
          <p>Una comida registrada no confirma un día completo. Los días sin actividad registrada se mantienen como desconocidos, no como descanso.</p>
          {d.nutrition.legacy_reconciliation_required && <p>Hay estimaciones históricas pendientes de revisión. Se excluyen del promedio para evitar contarlas dos veces.</p>}
        </div>
      </details>
      <details className="context-details">
        <summary>Actividad y sensaciones por día</summary>
        <div className="context-details-body">{d.days.filter((x: any) => x.consumed_entries || x.workouts.length || x.wellbeing.length).map((day: any) => <div className="list-row" key={day.date}>
          <strong>{day.date}</strong>
          <p>{day.consumed_entries} ingestas · {day.meals_complete === true ? 'Comidas completas' : 'Sin cierre confirmado'} · {day.known_totals.kcal == null ? 'Energía sin estimar' : `${day.known_totals.kcal} kcal conocidas`}</p>
          {day.workouts.map((x: any) => <p key={x.id}>{x.description} · {x.elapsed_minutes ?? 'Desconocidos'} min transcurridos · {x.active_minutes ?? 'Desconocidos'} min activos</p>)}
          {day.wellbeing.map((x: any) => <p key={x.id}>{x.data.description || `${x.data.hours ?? '—'} h de sueño`}</p>)}
        </div>)}</div>
      </details>
      <details className="context-details evidence">
        <summary>Fuentes del análisis</summary>
        <div className="context-details-body"><p>Revisión {d.health_revision} · cálculo {d.algorithm_version}</p>
          {d.days.filter((x: any) => x.nutrition_source_ids.length || x.workouts.length || x.wellbeing.length).map((day: any) => <p className="original-note" key={day.date}>{day.date}: {[...day.nutrition_source_ids, ...day.workouts.map((x: any) => x.id), ...day.wellbeing.map((x: any) => x.id)].join(', ')}</p>)}
        </div>
      </details>
    </section>
  );
}
