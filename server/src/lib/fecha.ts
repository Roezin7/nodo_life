// Utilidades de fecha en la zona horaria del usuario (America/Mexico_City).
// Trabajamos las fechas "de calendario" como string YYYY-MM-DD y las columnas
// @db.Date como medianoche UTC de ese día, para que no se corran por TZ.

const TZ = 'America/Mexico_City';

/** Fecha de hoy en México como 'YYYY-MM-DD'. */
export function hoyMX(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Hora actual en México como 'HH:MM' (24h). Para el scheduler de recordatorios. */
export function horaMX(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

/** 'YYYY-MM-DD' -> Date a medianoche UTC (para columnas @db.Date). */
export function fechaDate(iso: string): Date {
  return new Date(iso + 'T00:00:00Z');
}

/** Date (@db.Date) -> 'YYYY-MM-DD'. */
export function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Suma n días a un 'YYYY-MM-DD' y devuelve 'YYYY-MM-DD'. */
export function masDias(isoStr: string, n: number): string {
  const d = fechaDate(isoStr);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

/** Lunes (inicio de semana) del 'YYYY-MM-DD' dado, como 'YYYY-MM-DD'. */
export function lunesDe(isoStr: string): string {
  const d = fechaDate(isoStr);
  const dow = d.getUTCDay(); // 0=domingo
  const diff = (dow === 0 ? -6 : 1) - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return iso(d);
}
