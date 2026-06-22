// Lógica pura de hábitos: rachas y cumplimiento semanal sobre fechas completadas.

/** Días (YYYY-MM-DD) en orden ascendente que se marcaron como completados. */
export function rachaActual(fechasCompletadas: string[], hoy: string): number {
  const set = new Set(fechasCompletadas);
  let racha = 0;
  const d = new Date(hoy + 'T00:00:00Z');
  // Si hoy no está hecho, la racha cuenta hasta ayer (no se rompe por aún no marcar hoy).
  if (!set.has(hoy)) d.setUTCDate(d.getUTCDate() - 1);
  for (;;) {
    const iso = d.toISOString().slice(0, 10);
    if (set.has(iso)) {
      racha++;
      d.setUTCDate(d.getUTCDate() - 1);
    } else break;
  }
  return racha;
}

/** Racha más larga histórica. */
export function rachaMaxima(fechasCompletadas: string[]): number {
  const orden = [...new Set(fechasCompletadas)].sort();
  let max = 0;
  let actual = 0;
  let previa: Date | null = null;
  for (const f of orden) {
    const d = new Date(f + 'T00:00:00Z');
    if (previa && (d.getTime() - previa.getTime()) === 86_400_000) actual++;
    else actual = 1;
    if (actual > max) max = actual;
    previa = d;
  }
  return max;
}

/** Conteo de días completados dentro de [inicioSemana, inicioSemana+6]. */
export function diasEstaSemana(fechasCompletadas: string[], inicioSemana: string): number {
  const inicio = new Date(inicioSemana + 'T00:00:00Z');
  const fin = new Date(inicio);
  fin.setUTCDate(fin.getUTCDate() + 6);
  return fechasCompletadas.filter((f) => {
    const d = new Date(f + 'T00:00:00Z');
    return d >= inicio && d <= fin;
  }).length;
}

/** % de cumplimiento semanal según la meta (diaria=7, semanal_x_veces=meta). */
export function cumplimientoSemanal(diasHechos: number, metaSemanal: number): number {
  if (metaSemanal <= 0) return 0;
  return Math.round(Math.min(diasHechos / metaSemanal, 1) * 100) / 100;
}
