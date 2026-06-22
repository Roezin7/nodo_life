import { describe, it, expect } from 'vitest';
import { calcularPosicion, aMXN } from './logic.js';

describe('calcularPosicion', () => {
  it('calcula valor, pnl y rendimiento', () => {
    const r = calcularPosicion({ cantidad: 10, precio_compra_prom: 100, precio_actual: 120 });
    expect(r.costo).toBe(1000);
    expect(r.valor_actual).toBe(1200);
    expect(r.pnl).toBe(200);
    expect(r.rendimiento).toBe(0.2);
  });
  it('deja valores nulos sin precio actual', () => {
    const r = calcularPosicion({ cantidad: 10, precio_compra_prom: 100, precio_actual: null });
    expect(r.costo).toBe(1000);
    expect(r.valor_actual).toBeNull();
    expect(r.pnl).toBeNull();
  });
});

describe('aMXN', () => {
  it('convierte USD con la tasa', () => {
    expect(aMXN(100, 'USD', 18)).toBe(1800);
  });
  it('deja MXN igual', () => {
    expect(aMXN(100, 'MXN', null)).toBe(100);
  });
  it('es null si falta FX para USD', () => {
    expect(aMXN(100, 'USD', null)).toBeNull();
  });
});
