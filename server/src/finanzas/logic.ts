// Lógica pura de finanzas personales (sin DB). Aquí van los KPIs derivados.

export function redondear(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface MovSaldo {
  tipo: 'ingreso' | 'gasto' | 'transferencia';
  monto: number;
  cuenta_origen_id: number | null;
  cuenta_destino_id: number | null;
}

/**
 * Saldo actual por cuenta = saldo_inicial + Σ entradas − Σ salidas.
 * - ingreso: suma a cuenta_destino.
 * - gasto: resta de cuenta_origen.
 * - transferencia: resta de origen, suma a destino.
 * Devuelve mapa cuenta_id -> saldo.
 */
export function saldosPorCuenta(
  iniciales: Record<number, number>,
  movs: MovSaldo[],
): Record<number, number> {
  const saldos: Record<number, number> = { ...iniciales };
  const sumar = (id: number | null, delta: number) => {
    if (id == null) return;
    saldos[id] = redondear((saldos[id] ?? 0) + delta);
  };
  for (const m of movs) {
    if (m.tipo === 'ingreso') sumar(m.cuenta_destino_id, m.monto);
    else if (m.tipo === 'gasto') sumar(m.cuenta_origen_id, -m.monto);
    else if (m.tipo === 'transferencia') {
      sumar(m.cuenta_origen_id, -m.monto);
      sumar(m.cuenta_destino_id, m.monto);
    }
  }
  return saldos;
}

/** Tasa de ahorro = (ingresos − gastos) / ingresos. 0 si no hay ingresos. */
export function tasaAhorro(ingresos: number, gastos: number): number {
  if (ingresos <= 0) return 0;
  return redondear((ingresos - gastos) / ingresos);
}

export interface ResumenMes {
  ingresos: number;
  gastos: number;
  flujo: number; // ingresos − gastos
  tasa_ahorro: number;
}

export function resumenMes(ingresos: number, gastos: number): ResumenMes {
  return {
    ingresos: redondear(ingresos),
    gastos: redondear(gastos),
    flujo: redondear(ingresos - gastos),
    tasa_ahorro: tasaAhorro(ingresos, gastos),
  };
}

/** Estado de un presupuesto contra el gasto del periodo. */
export function estadoPresupuesto(gastado: number, limite: number) {
  const ratio = limite > 0 ? gastado / limite : 0;
  let nivel: 'ok' | 'cerca' | 'excedido' = 'ok';
  if (ratio >= 1) nivel = 'excedido';
  else if (ratio >= 0.8) nivel = 'cerca';
  return { gastado: redondear(gastado), limite: redondear(limite), ratio: redondear(ratio), nivel };
}
