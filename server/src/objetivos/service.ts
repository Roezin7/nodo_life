import { prisma } from '../db.js';
import { num0 } from '../lib/num.js';
import { HttpError } from '../middleware/error.js';
import { iso, fechaDate } from '../lib/fecha.js';
import { cumplimientoHabito } from '../habitos/service.js';
import { avanceProyecto } from '../tareas/service.js';
import { patrimonioActual } from '../patrimonio/service.js';

export function progresoPct(valorActual: number, metaValor: number): number {
  if (metaValor <= 0) return 0;
  return Math.round(Math.min(valorActual / metaValor, 1) * 100) / 100;
}

export interface ObjetivoInput {
  nombre: string;
  area_id: number;
  horizonte?: 'trimestral' | 'anual';
  metrica?: string;
  unidad?: string;
  meta_valor: number;
  valor_actual?: number;
  fecha_inicio?: string;
  fecha_fin?: string;
}

export async function crearObjetivo(o: ObjetivoInput) {
  const creado = await prisma.objetivos.create({
    data: {
      nombre: o.nombre,
      area_id: BigInt(o.area_id),
      horizonte: o.horizonte ?? 'trimestral',
      metrica: o.metrica ?? null,
      unidad: o.unidad ?? null,
      meta_valor: o.meta_valor,
      valor_actual: o.valor_actual ?? 0,
      fecha_inicio: o.fecha_inicio ? fechaDate(o.fecha_inicio) : null,
      fecha_fin: o.fecha_fin ? fechaDate(o.fecha_fin) : null,
    },
  });
  return { id: Number(creado.id) };
}

export async function editarObjetivo(id: bigint, o: Partial<ObjetivoInput> & { estado?: 'activo' | 'logrado' | 'vencido' }) {
  const existe = await prisma.objetivos.findUnique({ where: { id } });
  if (!existe) throw new HttpError(404, 'Objetivo no encontrado');
  await prisma.objetivos.update({
    where: { id },
    data: {
      nombre: o.nombre,
      area_id: o.area_id != null ? BigInt(o.area_id) : undefined,
      horizonte: o.horizonte,
      metrica: o.metrica,
      unidad: o.unidad,
      meta_valor: o.meta_valor,
      valor_actual: o.valor_actual,
      estado: o.estado,
      fecha_inicio: o.fecha_inicio ? fechaDate(o.fecha_inicio) : undefined,
      fecha_fin: o.fecha_fin ? fechaDate(o.fecha_fin) : undefined,
    },
  });
  return { ok: true };
}

export async function borrarObjetivo(id: bigint) {
  const existe = await prisma.objetivos.findUnique({ where: { id } });
  if (!existe) throw new HttpError(404, 'Objetivo no encontrado');
  await prisma.objetivos.delete({ where: { id } });
  return { ok: true };
}

// --- Vínculos (fuente del progreso) ---
export async function agregarVinculo(objetivoId: bigint, fuente: 'manual' | 'habito' | 'proyecto' | 'kpi_financiero', refId?: number | null) {
  const existe = await prisma.objetivos.findUnique({ where: { id: objetivoId } });
  if (!existe) throw new HttpError(404, 'Objetivo no encontrado');
  const v = await prisma.objetivo_vinculos.create({
    data: { objetivo_id: objetivoId, fuente, ref_id: refId != null ? BigInt(refId) : null },
  });
  return { id: Number(v.id) };
}

export async function borrarVinculo(id: bigint) {
  await prisma.objetivo_vinculos.deleteMany({ where: { id } });
  return { ok: true };
}

/**
 * Recalcula valor_actual desde la primera fuente vinculada (si la hay):
 * - habito: % de cumplimiento semanal × meta_valor.
 * - proyecto: % de tareas hechas × meta_valor.
 * - kpi_financiero: patrimonio neto actual (la meta es un monto objetivo).
 * - manual / sin vínculo: no toca el valor.
 */
async function valorDesdeFuente(objetivo: { id: bigint; meta_valor: unknown }, vinculo: { fuente: string; ref_id: bigint | null } | null): Promise<number | null> {
  if (!vinculo || vinculo.fuente === 'manual') return null;
  const meta = num0(objetivo.meta_valor as never);
  if (vinculo.fuente === 'habito' && vinculo.ref_id) {
    return Math.round(((await cumplimientoHabito(vinculo.ref_id)) * meta) * 100) / 100;
  }
  if (vinculo.fuente === 'proyecto' && vinculo.ref_id) {
    return Math.round(((await avanceProyecto(vinculo.ref_id)) * meta) * 100) / 100;
  }
  if (vinculo.fuente === 'kpi_financiero') {
    return (await patrimonioActual()).patrimonio_neto;
  }
  return null;
}

export async function recalcular() {
  const objetivos = await prisma.objetivos.findMany({ include: { vinculos: true } });
  for (const o of objetivos) {
    const vinculo = o.vinculos[0] ?? null;
    const valor = await valorDesdeFuente(o, vinculo);
    if (valor == null) continue;
    const logrado = valor >= num0(o.meta_valor);
    await prisma.objetivos.update({
      where: { id: o.id },
      data: { valor_actual: valor, estado: logrado ? 'logrado' : o.estado === 'logrado' ? 'activo' : o.estado },
    });
  }
  return { ok: true };
}

export async function listar() {
  await recalcular();
  const objetivos = await prisma.objetivos.findMany({
    orderBy: [{ estado: 'asc' }, { fecha_fin: 'asc' }],
    include: { area: true, vinculos: true },
  });
  return objetivos.map((o) => {
    const valor = num0(o.valor_actual);
    const meta = num0(o.meta_valor);
    return {
      id: Number(o.id),
      nombre: o.nombre,
      area_id: Number(o.area_id),
      area_nombre: o.area.nombre,
      area_color: o.area.color,
      horizonte: o.horizonte,
      metrica: o.metrica,
      unidad: o.unidad,
      meta_valor: meta,
      valor_actual: valor,
      progreso: progresoPct(valor, meta),
      estado: o.estado,
      fecha_inicio: o.fecha_inicio ? iso(o.fecha_inicio) : null,
      fecha_fin: o.fecha_fin ? iso(o.fecha_fin) : null,
      vinculos: o.vinculos.map((v) => ({ id: Number(v.id), fuente: v.fuente, ref_id: v.ref_id ? Number(v.ref_id) : null })),
    };
  });
}
