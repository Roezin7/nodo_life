// Lógica pura de salud: media móvil para suavizar el ruido del peso diario.

export interface PuntoPeso {
  fecha: string; // YYYY-MM-DD
  peso: number;
}

export interface PuntoPesoMM extends PuntoPeso {
  media_movil: number; // media móvil de los últimos N puntos (incluido el actual)
}

/** Media móvil simple de ventana `ventana` (default 7) sobre la serie ordenada por fecha. */
export function mediaMovil(puntos: PuntoPeso[], ventana = 7): PuntoPesoMM[] {
  return puntos.map((p, i) => {
    const desde = Math.max(0, i - ventana + 1);
    const trozo = puntos.slice(desde, i + 1);
    const media = trozo.reduce((a, x) => a + x.peso, 0) / trozo.length;
    return { ...p, media_movil: Math.round(media * 100) / 100 };
  });
}

/** Variación entre el primer y el último punto de la serie (kg). */
export function variacion(puntos: PuntoPeso[]): number | null {
  if (puntos.length < 2) return null;
  return Math.round((puntos[puntos.length - 1]!.peso - puntos[0]!.peso) * 100) / 100;
}
