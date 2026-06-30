import { prisma } from '../db.js';

// Configuración key-value de la app. Valores por defecto si no están en la DB.
export const DEFAULTS: Record<string, string> = {
  snapshot_cadencia_dias: '7', // patrimonio: cada cuántos días sugerir snapshot
  peso_recordatorio_hora: '07:30', // recordatorio diario de pesarse
  tareas_recordatorio_hora: '08:00', // resumen diario de tareas que vencen hoy
  fx_par: 'USD/MXN',
};

export async function getTodo(): Promise<Record<string, string>> {
  const filas = await prisma.config.findMany();
  const map: Record<string, string> = { ...DEFAULTS };
  for (const f of filas) map[f.clave] = f.valor;
  return map;
}

export async function get(clave: string): Promise<string | null> {
  const f = await prisma.config.findUnique({ where: { clave } });
  return f?.valor ?? DEFAULTS[clave] ?? null;
}

export async function set(clave: string, valor: string): Promise<void> {
  await prisma.config.upsert({
    where: { clave },
    update: { valor },
    create: { clave, valor },
  });
}
