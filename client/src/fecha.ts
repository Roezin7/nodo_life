const TZ = 'America/Mexico_City';

export function hoyMX(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function mesMX(): string {
  return hoyMX().slice(0, 7);
}

export function masDiasMX(n: number): string {
  const d = new Date(`${hoyMX()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
