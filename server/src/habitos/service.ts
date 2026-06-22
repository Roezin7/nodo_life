import { prisma } from '../db.js';
import { num0 } from '../lib/num.js';
import { HttpError } from '../middleware/error.js';
import { iso, fechaDate, hoyMX, lunesDe } from '../lib/fecha.js';
import { rachaActual, rachaMaxima, diasEstaSemana, cumplimientoSemanal } from './logic.js';

export interface HabitoInput {
  nombre: string;
  area_id: number;
  tipo?: 'binario' | 'numerico' | 'tiempo';
  frecuencia?: 'diaria' | 'semanal_x_veces';
  meta?: number | null;
  recordatorio_hora?: string | null;
}

export async function crearHabito(h: HabitoInput) {
  const max = await prisma.habitos.aggregate({ _max: { orden: true } });
  const creado = await prisma.habitos.create({
    data: {
      nombre: h.nombre,
      area_id: BigInt(h.area_id),
      tipo: h.tipo ?? 'binario',
      frecuencia: h.frecuencia ?? 'diaria',
      meta: h.meta ?? null,
      recordatorio_hora: h.recordatorio_hora ?? null,
      orden: (max._max.orden ?? 0) + 1,
    },
  });
  return { id: Number(creado.id) };
}

export async function editarHabito(id: bigint, h: Partial<HabitoInput> & { activo?: boolean; orden?: number }) {
  const existe = await prisma.habitos.findUnique({ where: { id } });
  if (!existe) throw new HttpError(404, 'Hábito no encontrado');
  await prisma.habitos.update({
    where: { id },
    data: {
      nombre: h.nombre,
      area_id: h.area_id != null ? BigInt(h.area_id) : undefined,
      tipo: h.tipo,
      frecuencia: h.frecuencia,
      meta: h.meta === undefined ? undefined : h.meta,
      recordatorio_hora: h.recordatorio_hora === undefined ? undefined : h.recordatorio_hora,
      activo: h.activo,
      orden: h.orden,
    },
  });
  return { ok: true };
}

export async function borrarHabito(id: bigint) {
  const existe = await prisma.habitos.findUnique({ where: { id } });
  if (!existe) throw new HttpError(404, 'Hábito no encontrado');
  await prisma.habitos.delete({ where: { id } });
  return { ok: true };
}

/** Marca/registra un hábito en una fecha (upsert). completado o valor numérico. */
export async function registrar(habitoId: bigint, data: { fecha?: string; valor?: number; completado?: boolean }) {
  const habito = await prisma.habitos.findUnique({ where: { id: habitoId } });
  if (!habito) throw new HttpError(404, 'Hábito no encontrado');
  const fecha = fechaDate(data.fecha ?? hoyMX());
  // Para numérico/tiempo: completado = valor alcanza la meta (si hay meta).
  let completado = data.completado ?? false;
  if (habito.tipo !== 'binario' && data.valor != null) {
    completado = habito.meta != null ? data.valor >= num0(habito.meta) : data.valor > 0;
  }
  const r = await prisma.habito_registros.upsert({
    where: { habito_id_fecha: { habito_id: habitoId, fecha } },
    update: { valor: data.valor ?? null, completado },
    create: { habito_id: habitoId, fecha, valor: data.valor ?? null, completado },
  });
  return { id: Number(r.id), completado };
}

/** Quita el registro de una fecha (destachar). */
export async function desmarcar(habitoId: bigint, fechaStr: string) {
  const fecha = fechaDate(fechaStr);
  await prisma.habito_registros.deleteMany({ where: { habito_id: habitoId, fecha } });
  return { ok: true };
}

function metaSemanal(h: { frecuencia: string; meta: unknown }): number {
  return h.frecuencia === 'semanal_x_veces' ? num0(h.meta as never) || 1 : 7;
}

/**
 * Tracker: cada hábito activo con su estado de hoy, racha, % semanal y el detalle
 * de la semana actual (lunes→domingo) para pintar los checks.
 */
export async function tracker(semanaInicio?: string) {
  const hoy = hoyMX();
  const inicio = semanaInicio ?? lunesDe(hoy);
  const habitos = await prisma.habitos.findMany({
    where: { activo: true },
    orderBy: [{ orden: 'asc' }, { id: 'asc' }],
    include: { area: true, registros: { where: { completado: true } } },
  });

  const dias: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(inicio + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + i);
    dias.push(iso(d));
  }

  return {
    semana_inicio: inicio,
    dias,
    habitos: habitos.map((h) => {
      const fechas = h.registros.map((r) => iso(r.fecha));
      const meta = metaSemanal(h);
      const hechos = diasEstaSemana(fechas, inicio);
      return {
        id: Number(h.id),
        nombre: h.nombre,
        area_id: Number(h.area_id),
        area_nombre: h.area.nombre,
        area_color: h.area.color,
        tipo: h.tipo,
        frecuencia: h.frecuencia,
        meta: h.meta != null ? num0(h.meta) : null,
        recordatorio_hora: h.recordatorio_hora,
        hecho_hoy: fechas.includes(hoy),
        racha: rachaActual(fechas, hoy),
        racha_max: rachaMaxima(fechas),
        dias_semana: hechos,
        meta_semanal: meta,
        cumplimiento_semanal: cumplimientoSemanal(hechos, meta),
        semana: dias.map((d) => ({ fecha: d, hecho: fechas.includes(d) })),
      };
    }),
  };
}

/** % de cumplimiento de un hábito (para vincular a un objetivo). */
export async function cumplimientoHabito(habitoId: bigint): Promise<number> {
  const habito = await prisma.habitos.findUnique({
    where: { id: habitoId },
    include: { registros: { where: { completado: true } } },
  });
  if (!habito) return 0;
  const fechas = habito.registros.map((r) => iso(r.fecha));
  const meta = metaSemanal(habito);
  return cumplimientoSemanal(diasEstaSemana(fechas, lunesDe(hoyMX())), meta);
}
