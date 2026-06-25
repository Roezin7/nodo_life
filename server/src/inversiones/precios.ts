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

// Stooq es gratis y sin API key (cubre acciones, ETFs y fondos de EE.UU.), así que
// siempre hay una fuente de precios; Finnhub sólo mejora la cobertura/latencia.
export const preciosDisponibles = () => true;

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

/**
 * Quote de Stooq (gratis, sin API key). A diferencia de Finnhub free, sí cubre
 * fondos mutuos de EE.UU. (p.ej. SWPPX), además de acciones y ETFs. CSV con
 * columnas Symbol,Date,Time,Open,High,Low,Close,Volume → tomamos el cierre.
 */
async function fetchPrecioStooq(ticker: string): Promise<number | null> {
  try {
    const sym = `${ticker.toLowerCase()}.us`;
    const url = `https://stooq.com/q/l/?s=${encodeURIComponent(sym)}&f=sd2t2ohlcv&h&e=csv`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const csv = await r.text();
    const linea = csv.trim().split('\n')[1]; // 1ª fila = encabezados
    if (!linea) return null;
    const cols = linea.split(',');
    const cierre = Number(cols[6]); // Close
    return Number.isFinite(cierre) && cierre > 0 ? cierre : null;
  } catch {
    return null;
  }
}

/** Precio "mejor esfuerzo": Finnhub y, si no cotiza ahí (fondos), Stooq. */
async function fetchPrecio(ticker: string): Promise<number | null> {
  const finnhub = await fetchPrecioFinnhub(ticker);
  if (finnhub != null) return finnhub;
  return fetchPrecioStooq(ticker);
}

/**
 * Verifica que un ticker exista y sea cotizable por el proveedor (Finnhub free:
 * acciones y ETFs de EE.UU.). Devuelve el precio y el nombre si lo encuentra.
 * Nota: los fondos mutuos (p.ej. SWPPX) NO cotizan en el free tier de Finnhub,
 * así que devolverán `no_cotiza` aunque el símbolo exista.
 */
export async function verificarTicker(ticker: string): Promise<{ found: boolean; precio: number | null; nombre: string | null; motivo?: string }> {
  const t = ticker.trim().toUpperCase();
  // Finnhub (si hay key) y, si no cotiza ahí (p.ej. fondos), Stooq como respaldo.
  const precio = (await fetchPrecioFinnhub(t)) ?? (await fetchPrecioStooq(t));
  if (precio == null) {
    return { found: false, precio: null, nombre: null, motivo: env.FINNHUB_API_KEY ? 'no_cotiza' : 'sin_api_key' };
  }
  if (!env.FINNHUB_API_KEY) return { found: true, precio, nombre: null }; // sólo Stooq, sin búsqueda de nombre
  // Nombre legible vía búsqueda de símbolos (best-effort).
  let nombre: string | null = null;
  try {
    const r = await fetch(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(t)}&token=${env.FINNHUB_API_KEY}`, { signal: AbortSignal.timeout(8000) });
    if (r.ok) {
      const j = (await r.json()) as { result?: { symbol?: string; description?: string }[] };
      nombre = j.result?.find((x) => x.symbol?.toUpperCase() === t)?.description ?? null;
    }
  } catch {
    // ignoramos: el nombre es opcional
  }
  return { found: true, precio, nombre };
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
    const fresco = await fetchPrecio(ticker);
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
