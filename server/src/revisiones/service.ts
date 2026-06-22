import { prisma } from '../db.js';
import { HttpError } from '../middleware/error.js';
import { iso, fechaDate, hoyMX } from '../lib/fecha.js';
import { generarSnapshot } from '../patrimonio/service.js';
import { recalcular as recalcularObjetivos } from '../objetivos/service.js';

export async function listar(tipo?: 'diaria' | 'semanal') {
  const revs = await prisma.revisiones.findMany({
    where: tipo ? { tipo } : {},
    orderBy: { fecha: 'desc' },
    take: 60,
  });
  return revs.map((r) => ({
    id: Number(r.id),
    tipo: r.tipo,
    fecha: iso(r.fecha),
    notas: r.notas,
    ia_resumen: r.ia_resumen_json,
  }));
}

/**
 * Crea una revisión. El cierre SEMANAL además dispara los snapshots/tendencias:
 * congela el patrimonio y recalcula el progreso de objetivos.
 */
export async function crear(data: { tipo: 'diaria' | 'semanal'; fecha?: string; notas?: string; ia_resumen?: unknown }) {
  const fecha = fechaDate(data.fecha ?? hoyMX());
  const rev = await prisma.revisiones.create({
    data: {
      tipo: data.tipo,
      fecha,
      notas: data.notas ?? null,
      ia_resumen_json: data.ia_resumen ? (data.ia_resumen as object) : undefined,
    },
  });
  if (data.tipo === 'semanal') {
    await generarSnapshot(data.fecha);
    await recalcularObjetivos();
  }
  return { id: Number(rev.id), snapshot_generado: data.tipo === 'semanal' };
}

export async function borrar(id: bigint) {
  const existe = await prisma.revisiones.findUnique({ where: { id } });
  if (!existe) throw new HttpError(404, 'Revisión no encontrada');
  await prisma.revisiones.delete({ where: { id } });
  return { ok: true };
}
