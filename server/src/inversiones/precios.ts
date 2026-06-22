import { prisma } from '../db.js';
import { env } from '../env.js';
import { num0 } from '../lib/num.js';

// Precios diferidos gratis (Finnhub) + FX USD/MXN gratis (open.er-api.com).
// Cacheamos en DB y solo refrescamos si el dato es más viejo que TTL_MIN, para
// respetar el rate limit del free tier con pocos tickers.

const TTL_MIN = 15;
const FX_PAR = 'USD/MXN';

function viejo(fecha: Date): boolean {
  return Date.now() - fecha.getTime() > TTL_MIN * 60_000;
}

export const preciosDisponibles = () => !!env.FINNHUB_API_KEY;

/** Quote de Finnhub: devuelve el precio actual (campo c) o null si falla. */
async function fetchPrecioFinnhub(ticker: string): Promise<number | null> {
  if (!env.FINNHUB_API_KEY) return null;
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${env.FINNHUB_API_KEY}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { c?: number };
    return typeof j.c === 'number' && j.c > 0 ? j.c : null;
  } catch {
    return null;
  }
}

/** FX USD->MXN gratis y sin key. */
async function fetchFxUsdMxn(): Promise<number | null> {
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { rates?: { MXN?: number } };
    return typeof j.rates?.MXN === 'number' ? j.rates.MXN : null;
  } catch {
    return null;
  }
}

/** Devuelve la tasa USD/MXN cacheada, refrescándola si está vieja. */
export async function tasaUsdMxn(): Promise<number | null> {
  const cache = await prisma.fx_cache.findUnique({ where: { par: FX_PAR } });
  if (cache && !viejo(cache.actualizado_at)) return num0(cache.tasa);
  const fresca = await fetchFxUsdMxn();
  if (fresca == null) return cache ? num0(cache.tasa) : null; // degrada al cache viejo
  await prisma.fx_cache.upsert({
    where: { par: FX_PAR },
    update: { tasa: fresca, actualizado_at: new Date() },
    create: { par: FX_PAR, tasa: fresca },
  });
  return fresca;
}

/**
 * Precios actuales para los tickers dados (mapa ticker->precio|null), refrescando
 * solo los que estén viejos o ausentes. Crypto se omite (Finnhub no lo da en free).
 */
export async function preciosActuales(tickers: string[]): Promise<Map<string, number | null>> {
  const unicos = [...new Set(tickers.map((t) => t.toUpperCase()))];
  const cache = await prisma.precios_cache.findMany({ where: { ticker: { in: unicos } } });
  const cacheMap = new Map(cache.map((c) => [c.ticker, c]));
  const out = new Map<string, number | null>();

  for (const ticker of unicos) {
    const c = cacheMap.get(ticker);
    if (c && !viejo(c.actualizado_at)) {
      out.set(ticker, num0(c.precio_actual));
      continue;
    }
    const fresco = await fetchPrecioFinnhub(ticker);
    if (fresco != null) {
      await prisma.precios_cache.upsert({
        where: { ticker },
        update: { precio_actual: fresco, actualizado_at: new Date() },
        create: { ticker, precio_actual: fresco },
      });
      out.set(ticker, fresco);
    } else {
      out.set(ticker, c ? num0(c.precio_actual) : null); // degrada al cache viejo o null
    }
  }
  return out;
}
