// Lógica pura de inversiones (sin DB ni red): valuación y P&L por posición.

export function redondear(n: number, dec = 2): number {
  const f = 10 ** dec;
  return Math.round((n + Number.EPSILON) * f) / f;
}

export interface PosicionCalc {
  cantidad: number;
  precio_compra_prom: number;
  precio_actual: number | null;
}

export interface ResultadoPosicion {
  costo: number; // cantidad * precio_compra_prom (en moneda de la posición)
  valor_actual: number | null; // cantidad * precio_actual
  pnl: number | null; // valor_actual − costo
  rendimiento: number | null; // pnl / costo
}

export function calcularPosicion(p: PosicionCalc): ResultadoPosicion {
  const costo = redondear(p.cantidad * p.precio_compra_prom);
  if (p.precio_actual == null) {
    return { costo, valor_actual: null, pnl: null, rendimiento: null };
  }
  const valor_actual = redondear(p.cantidad * p.precio_actual);
  const pnl = redondear(valor_actual - costo);
  const rendimiento = costo > 0 ? redondear(pnl / costo, 4) : 0;
  return { costo, valor_actual, pnl, rendimiento };
}

/** Convierte un monto USD a MXN con la tasa dada (o lo deja igual si ya es MXN). */
export function aMXN(monto: number, moneda: string, fxUsdMxn: number | null): number | null {
  if (moneda === 'MXN') return redondear(monto);
  if (fxUsdMxn == null) return null;
  return redondear(monto * fxUsdMxn);
}
