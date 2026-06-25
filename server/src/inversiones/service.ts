import { prisma } from '../db.js';
import { num0 } from '../lib/num.js';
import { HttpError } from '../middleware/error.js';
import { fechaDate } from '../lib/fecha.js';
import { calcularPosicion, aMXN, redondear } from './logic.js';
import { preciosActuales, tasaUsdMxn, preciosDisponibles } from './precios.js';

export interface PosicionInput {
  ticker: string;
  nombre?: string;
  clase?: 'stock' | 'etf' | 'fondo' | 'crypto';
  cantidad: number;
  precio_compra_prom: number;
  moneda?: string;
  fecha_inicio?: string;
}

export async function crearPosicion(p: PosicionInput) {
  const pos = await prisma.posiciones.create({
    data: {
      ticker: p.ticker.toUpperCase(),
      nombre: p.nombre ?? null,
      clase: p.clase ?? 'etf',
      cantidad: p.cantidad,
      precio_compra_prom: p.precio_compra_prom,
      moneda: p.moneda ?? 'USD',
      fecha_inicio: p.fecha_inicio ? fechaDate(p.fecha_inicio) : null,
    },
  });
  return { id: Number(pos.id) };
}

export async function editarPosicion(id: bigint, p: Partial<PosicionInput> & { activo?: boolean }) {
  const existe = await prisma.posiciones.findUnique({ where: { id } });
  if (!existe) throw new HttpError(404, 'Posición no encontrada');
  await prisma.posiciones.update({
    where: { id },
    data: {
      ticker: p.ticker ? p.ticker.toUpperCase() : undefined,
      nombre: p.nombre,
      clase: p.clase,
      cantidad: p.cantidad,
      precio_compra_prom: p.precio_compra_prom,
      moneda: p.moneda,
      fecha_inicio: p.fecha_inicio ? fechaDate(p.fecha_inicio) : undefined,
      activo: p.activo,
    },
  });
  return { ok: true };
}

export async function borrarPosicion(id: bigint) {
  const existe = await prisma.posiciones.findUnique({ where: { id } });
  if (!existe) throw new HttpError(404, 'Posición no encontrada');
  await prisma.posiciones.delete({ where: { id } });
  return { ok: true };
}

/**
 * Portafolio valuado: cada posición con precio actual (cacheado), valor, P&L y
 * rendimiento; convierte USD→MXN para totalizar el aporte al patrimonio.
 */
export async function portafolio() {
  const posiciones = await prisma.posiciones.findMany({ where: { activo: true }, orderBy: { ticker: 'asc' } });
  // Solo cotizamos stocks/ETFs (Finnhub free). Crypto queda listo a futuro (precio null).
  const tickersCotizables = posiciones.filter((p) => p.clase !== 'crypto').map((p) => p.ticker);
  const [precios, fx] = await Promise.all([preciosActuales(tickersCotizables), tasaUsdMxn()]);

  let valorMXN = 0;
  let costoMXN = 0;
  const filas = posiciones.map((p) => {
    const precio = p.clase === 'crypto' ? null : precios.get(p.ticker.toUpperCase()) ?? null;
    const calc = calcularPosicion({
      cantidad: num0(p.cantidad),
      precio_compra_prom: num0(p.precio_compra_prom),
      precio_actual: precio,
    });
    const valor_mxn = calc.valor_actual != null ? aMXN(calc.valor_actual, p.moneda, fx) : null;
    const costo_mxn = aMXN(calc.costo, p.moneda, fx);
    if (valor_mxn != null) valorMXN += valor_mxn;
    if (costo_mxn != null) costoMXN += costo_mxn;
    return {
      id: Number(p.id),
      ticker: p.ticker,
      nombre: p.nombre,
      clase: p.clase,
      moneda: p.moneda,
      cantidad: num0(p.cantidad),
      precio_compra_prom: num0(p.precio_compra_prom),
      precio_actual: precio,
      costo: calc.costo,
      valor_actual: calc.valor_actual,
      pnl: calc.pnl,
      rendimiento: calc.rendimiento,
      valor_mxn,
    };
  });

  const pnlMXN = redondear(valorMXN - costoMXN);
  return {
    disponible: preciosDisponibles(),
    fx_usd_mxn: fx,
    posiciones: filas,
    totales: {
      costo_mxn: redondear(costoMXN),
      valor_mxn: redondear(valorMXN),
      pnl_mxn: pnlMXN,
      rendimiento: costoMXN > 0 ? redondear(pnlMXN / costoMXN, 4) : 0,
    },
  };
}

/** Valor del portafolio en MXN (para el snapshot de patrimonio). 0 si no hay datos. */
export async function valorPortafolioMXN(): Promise<number> {
  const posiciones = await prisma.posiciones.findMany({ where: { activo: true } });
  if (posiciones.length === 0) return 0;
  const tickers = posiciones.filter((p) => p.clase !== 'crypto').map((p) => p.ticker);
  const [precios, fx] = await Promise.all([preciosActuales(tickers), tasaUsdMxn()]);
  let total = 0;
  for (const p of posiciones) {
    const precio = p.clase === 'crypto' ? null : precios.get(p.ticker.toUpperCase()) ?? null;
    if (precio == null) continue;
    const valor = num0(p.cantidad) * precio;
    const mxn = aMXN(valor, p.moneda, fx);
    if (mxn != null) total += mxn;
  }
  return redondear(total);
}
