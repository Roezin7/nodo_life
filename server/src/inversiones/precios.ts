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

// Yahoo Finance es gratis y sin API key, y cubre acciones, ETFs, fondos mutuos
// (p.ej. SWPPX) y crypto, así que siempre hay una fuente de precios. Finnhub queda
// como respaldo opcional si hay key.
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

interface QuoteYahoo { precio: number; nombre: string | null; moneda: string | null }

/**
 * Quote de Yahoo Finance (gratis, sin API key). El endpoint `chart` devuelve en
 * `meta` el último precio de mercado, nombre y moneda. Cubre fondos mutuos como
 * SWPPX además de acciones, ETFs y crypto (BTC-USD). Requiere un User-Agent.
 */
async function fetchQuoteYahoo(ticker: string): Promise<QuoteYahoo | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      chart?: { result?: { meta?: { regularMarketPrice?: number; longName?: string; shortName?: string; currency?: string } }[] };
    };
    const meta = j.chart?.result?.[0]?.meta;
    const precio = meta?.regularMarketPrice;
    if (typeof precio !== 'number' || !(precio > 0)) return null;
    return { precio, nombre: meta?.longName ?? meta?.shortName ?? null, moneda: meta?.currency ?? null };
  } catch {
    return null;
  }
}

/** Precio "mejor esfuerzo": Yahoo (cubre todo) y, si falla, Finnhub. */
async function fetchPrecio(ticker: string): Promise<number | null> {
  const yahoo = await fetchQuoteYahoo(ticker);
  if (yahoo != null) return yahoo.precio;
  return fetchPrecioFinnhub(ticker);
}

/**
 * Verifica que un ticker exista y sea cotizable. Usa Yahoo Finance (cubre fondos
 * mutuos como SWPPX, acciones, ETFs y crypto) y, si falla, Finnhub como respaldo.
 * Devuelve el precio y el nombre legible si los encuentra.
 */
export async function verificarTicker(ticker: string): Promise<{ found: boolean; precio: number | null; nombre: string | null; motivo?: string }> {
  const t = ticker.trim().toUpperCase();
  const yahoo = await fetchQuoteYahoo(t);
  if (yahoo != null) return { found: true, precio: yahoo.precio, nombre: yahoo.nombre };
  // Respaldo: Finnhub (si hay key).
  const precio = await fetchPrecioFinnhub(t);
  if (precio == null) return { found: false, precio: null, nombre: null, motivo: 'no_cotiza' };
  return { found: true, precio, nombre: null };
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
