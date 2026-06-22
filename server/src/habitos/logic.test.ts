import { describe, it, expect } from 'vitest';
import { rachaActual, rachaMaxima, diasEstaSemana, cumplimientoSemanal } from './logic.js';

describe('rachaActual', () => {
  it('cuenta días consecutivos hasta hoy', () => {
    expect(rachaActual(['2026-06-20', '2026-06-21', '2026-06-22'], '2026-06-22')).toBe(3);
  });
  it('no se rompe si hoy aún no está hecho', () => {
    expect(rachaActual(['2026-06-20', '2026-06-21'], '2026-06-22')).toBe(2);
  });
  it('es 0 sin registros recientes', () => {
    expect(rachaActual(['2026-06-10'], '2026-06-22')).toBe(0);
  });
});

describe('rachaMaxima', () => {
  it('encuentra la racha más larga', () => {
    expect(rachaMaxima(['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-10'])).toBe(3);
  });
});

describe('diasEstaSemana / cumplimiento', () => {
  it('cuenta días dentro de la semana', () => {
    const fechas = ['2026-06-22', '2026-06-24', '2026-06-30'];
    expect(diasEstaSemana(fechas, '2026-06-22')).toBe(2); // lunes 22 → domingo 28
  });
  it('cumplimiento se topa en 100%', () => {
    expect(cumplimientoSemanal(8, 7)).toBe(1);
    expect(cumplimientoSemanal(3, 6)).toBe(0.5);
  });
});
