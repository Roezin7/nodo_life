import { describe, it, expect } from 'vitest';
import { mediaMovil, variacion } from './logic.js';

describe('mediaMovil', () => {
  it('promedia la ventana móvil', () => {
    const s = mediaMovil([{ fecha: 'a', peso: 80 }, { fecha: 'b', peso: 82 }, { fecha: 'c', peso: 78 }], 2);
    expect(s[0]!.media_movil).toBe(80);
    expect(s[1]!.media_movil).toBe(81); // (80+82)/2
    expect(s[2]!.media_movil).toBe(80); // (82+78)/2
  });
});

describe('variacion', () => {
  it('es último - primero', () => {
    expect(variacion([{ fecha: 'a', peso: 80 }, { fecha: 'b', peso: 77.5 }])).toBe(-2.5);
  });
  it('es null con menos de 2 puntos', () => {
    expect(variacion([{ fecha: 'a', peso: 80 }])).toBeNull();
  });
});
