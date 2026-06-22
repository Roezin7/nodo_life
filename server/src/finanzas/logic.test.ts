import { describe, it, expect } from 'vitest';
import { saldosPorCuenta, tasaAhorro, resumenMes, estadoPresupuesto, type MovSaldo } from './logic.js';

describe('saldosPorCuenta', () => {
  it('aplica ingreso, gasto y transferencia', () => {
    const movs: MovSaldo[] = [
      { tipo: 'ingreso', monto: 1000, cuenta_origen_id: null, cuenta_destino_id: 1 },
      { tipo: 'gasto', monto: 200, cuenta_origen_id: 1, cuenta_destino_id: null },
      { tipo: 'transferencia', monto: 300, cuenta_origen_id: 1, cuenta_destino_id: 2 },
    ];
    const s = saldosPorCuenta({ 1: 500, 2: 0 }, movs);
    expect(s[1]).toBe(1000); // 500 + 1000 - 200 - 300
    expect(s[2]).toBe(300);
  });
});

describe('tasaAhorro', () => {
  it('es (ingresos - gastos) / ingresos', () => {
    expect(tasaAhorro(1000, 600)).toBe(0.4);
  });
  it('es 0 sin ingresos', () => {
    expect(tasaAhorro(0, 500)).toBe(0);
  });
});

describe('resumenMes', () => {
  it('calcula flujo y tasa', () => {
    const r = resumenMes(1000, 250);
    expect(r.flujo).toBe(750);
    expect(r.tasa_ahorro).toBe(0.75);
  });
});

describe('estadoPresupuesto', () => {
  it('clasifica ok/cerca/excedido', () => {
    expect(estadoPresupuesto(50, 100).nivel).toBe('ok');
    expect(estadoPresupuesto(85, 100).nivel).toBe('cerca');
    expect(estadoPresupuesto(120, 100).nivel).toBe('excedido');
  });
});
