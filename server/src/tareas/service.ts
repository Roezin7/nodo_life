import { prisma } from '../db.js';
import { HttpError } from '../middleware/error.js';
import { iso, fechaDate, hoyMX } from '../lib/fecha.js';
import { areaDefaultId } from '../areas/service.js';

function serializarTarea(t: {
  id: bigint; titulo: string; area_id: bigint; proyecto_id: bigint | null; prioridad: string;
  fecha_vence: Date | null; recurrencia: string | null; estado: string; notas: string | null; completado_at: Date | null;
}) {
  return {
    id: Number(t.id),
    titulo: t.titulo,
    area_id: Number(t.area_id),
    proyecto_id: t.proyecto_id ? Number(t.proyecto_id) : null,
    prioridad: t.prioridad,
    fecha_vence: t.fecha_vence ? iso(t.fecha_vence) : null,
    recurrencia: t.recurrencia,
    estado: t.estado,
    notas: t.notas,
    completado_at: t.completado_at ? t.completado_at.toISOString() : null,
  };
}

// ---------------------------------------------------------------------------
//  Tareas
// ---------------------------------------------------------------------------
export interface TareaInput {
  titulo: string;
  area_id?: number;
  proyecto_id?: number | null;
  prioridad?: 'baja' | 'media' | 'alta';
  fecha_vence?: string | null;
  recurrencia?: string | null;
  notas?: string;
}

export async function crearTarea(t: TareaInput) {
  const area_id = t.area_id != null ? BigInt(t.area_id) : await areaDefaultId();
  const creada = await prisma.tareas.create({
    data: {
      titulo: t.titulo,
      area_id,
      proyecto_id: t.proyecto_id != null ? BigInt(t.proyecto_id) : null,
      prioridad: t.prioridad ?? 'media',
      fecha_vence: t.fecha_vence ? fechaDate(t.fecha_vence) : null,
      recurrencia: t.recurrencia ?? null,
      notas: t.notas ?? null,
    },
  });
  return { id: Number(creada.id) };
}

export async function editarTarea(id: bigint, t: Partial<TareaInput> & { estado?: 'pendiente' | 'hecha' }) {
  const existe = await prisma.tareas.findUnique({ where: { id } });
  if (!existe) throw new HttpError(404, 'Tarea no encontrada');
  const completar = t.estado === 'hecha' && existe.estado !== 'hecha';
  const reabrir = t.estado === 'pendiente' && existe.estado === 'hecha';
  await prisma.tareas.update({
    where: { id },
    data: {
      titulo: t.titulo,
      area_id: t.area_id != null ? BigInt(t.area_id) : undefined,
      proyecto_id: t.proyecto_id === undefined ? undefined : t.proyecto_id != null ? BigInt(t.proyecto_id) : null,
      prioridad: t.prioridad,
      fecha_vence: t.fecha_vence === undefined ? undefined : t.fecha_vence ? fechaDate(t.fecha_vence) : null,
      recurrencia: t.recurrencia === undefined ? undefined : t.recurrencia,
      notas: t.notas,
      estado: t.estado,
      completado_at: completar ? new Date() : reabrir ? null : undefined,
    },
  });
  return { ok: true };
}

export async function borrarTarea(id: bigint) {
  const existe = await prisma.tareas.findUnique({ where: { id } });
  if (!existe) throw new HttpError(404, 'Tarea no encontrada');
  await prisma.tareas.delete({ where: { id } });
  return { ok: true };
}

/**
 * Vistas de tareas:
 * - hoy: pendientes que vencen hoy o antes (atrasadas) across áreas.
 * - inbox: pendientes sin proyecto.
 * - todas: pendientes (con filtros área/proyecto).
 */
export async function listarTareas(vista: 'hoy' | 'inbox' | 'todas', filtros: { area_id?: number; proyecto_id?: number; incluir_hechas?: boolean } = {}) {
  const hoy = hoyMX();
  const where: Record<string, unknown> = {};
  if (!filtros.incluir_hechas) where.estado = 'pendiente';
  if (vista === 'hoy') where.fecha_vence = { lte: fechaDate(hoy) };
  if (vista === 'inbox') where.proyecto_id = null;
  if (filtros.area_id != null) where.area_id = BigInt(filtros.area_id);
  if (filtros.proyecto_id != null) where.proyecto_id = BigInt(filtros.proyecto_id);

  const tareas = await prisma.tareas.findMany({
    where,
    orderBy: [{ fecha_vence: { sort: 'asc', nulls: 'last' } }, { prioridad: 'desc' }, { id: 'desc' }],
    take: 500,
  });
  return tareas.map(serializarTarea);
}

/**
 * Tablero estilo "notas por día": las tareas generales (sin proyecto) se agrupan
 * por su día (fecha_vence). Solo aparecen los días que tienen tareas pendientes,
 * ordenados de más próximo a más lejano (los atrasados van primero). Además, una
 * columna por proyecto activo. Las tareas legacy sin fecha caen en `sin_fecha`.
 */
export async function tablero() {
  const orden = [{ fecha_vence: { sort: 'asc' as const, nulls: 'last' as const } }, { prioridad: 'desc' as const }, { id: 'desc' as const }];
  const [generales, proyectos] = await Promise.all([
    prisma.tareas.findMany({ where: { estado: 'pendiente', proyecto_id: null }, orderBy: orden, take: 500 }),
    prisma.proyectos.findMany({
      where: { estado: { not: 'hecho' } },
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
      include: { area: true, tareas: { orderBy: orden } },
    }),
  ]);

  // Agrupa por día (clave ISO). Preserva el orden de `generales` (ya viene asc por fecha).
  const porDia = new Map<string, ReturnType<typeof serializarTarea>[]>();
  const sin_fecha: ReturnType<typeof serializarTarea>[] = [];
  for (const t of generales) {
    const s = serializarTarea(t);
    if (t.fecha_vence == null) { sin_fecha.push(s); continue; }
    const clave = iso(t.fecha_vence);
    const lista = porDia.get(clave) ?? [];
    lista.push(s);
    porDia.set(clave, lista);
  }
  const dias = [...porDia.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([fecha, tareas]) => ({ fecha, tareas }));

  return {
    dias,
    sin_fecha,
    proyectos: proyectos.map((p) => {
      const total = p.tareas.length;
      const hechas = p.tareas.filter((t) => t.estado === 'hecha').length;
      return {
        id: Number(p.id),
        nombre: p.nombre,
        area_id: Number(p.area_id),
        area_nombre: p.area.nombre,
        area_color: p.area.color,
        estado: p.estado,
        tareas_total: total,
        tareas_hechas: hechas,
        avance: avancePct(hechas, total),
        tareas: p.tareas.filter((t) => t.estado === 'pendiente').map(serializarTarea),
      };
    }),
  };
}

// ---------------------------------------------------------------------------
//  Proyectos (avance derivado de % tareas hechas + bitácora)
// ---------------------------------------------------------------------------
export interface ProyectoInput {
  nombre: string;
  area_id?: number;
  descripcion?: string;
  estado?: 'activo' | 'pausado' | 'hecho';
}

export async function crearProyecto(p: ProyectoInput) {
  const area_id = p.area_id != null ? BigInt(p.area_id) : await areaDefaultId();
  const max = await prisma.proyectos.aggregate({ _max: { orden: true } });
  const creado = await prisma.proyectos.create({
    data: {
      nombre: p.nombre,
      area_id,
      descripcion: p.descripcion ?? null,
      estado: p.estado ?? 'activo',
      orden: (max._max.orden ?? 0) + 1,
    },
  });
  return { id: Number(creado.id) };
}

export async function editarProyecto(id: bigint, p: Partial<ProyectoInput> & { orden?: number }) {
  const existe = await prisma.proyectos.findUnique({ where: { id } });
  if (!existe) throw new HttpError(404, 'Proyecto no encontrado');
  await prisma.proyectos.update({
    where: { id },
    data: {
      nombre: p.nombre,
      area_id: p.area_id != null ? BigInt(p.area_id) : undefined,
      descripcion: p.descripcion,
      estado: p.estado,
      orden: p.orden,
    },
  });
  return { ok: true };
}

export async function borrarProyecto(id: bigint) {
  const existe = await prisma.proyectos.findUnique({ where: { id } });
  if (!existe) throw new HttpError(404, 'Proyecto no encontrado');
  // Las tareas quedan huérfanas (proyecto_id -> null por onDelete: SetNull).
  await prisma.proyectos.delete({ where: { id } });
  return { ok: true };
}

/** % de avance de un proyecto = tareas hechas / tareas totales. */
export function avancePct(hechas: number, total: number): number {
  return total > 0 ? Math.round((hechas / total) * 100) / 100 : 0;
}

export async function listarProyectos(incluirHechos = true) {
  const proyectos = await prisma.proyectos.findMany({
    where: incluirHechos ? {} : { estado: { not: 'hecho' } },
    orderBy: [{ orden: 'asc' }, { id: 'asc' }],
    include: { area: true, tareas: { select: { estado: true } }, _count: { select: { tareas: true } } },
  });
  return proyectos.map((p) => {
    const total = p.tareas.length;
    const hechas = p.tareas.filter((t) => t.estado === 'hecha').length;
    return {
      id: Number(p.id),
      nombre: p.nombre,
      area_id: Number(p.area_id),
      area_nombre: p.area.nombre,
      area_color: p.area.color,
      estado: p.estado,
      descripcion: p.descripcion,
      tareas_total: total,
      tareas_hechas: hechas,
      avance: avancePct(hechas, total),
    };
  });
}

export async function detalleProyecto(id: bigint) {
  const p = await prisma.proyectos.findUnique({
    where: { id },
    include: { area: true, tareas: true, avances: { orderBy: { fecha: 'desc' } } },
  });
  if (!p) throw new HttpError(404, 'Proyecto no encontrado');
  const total = p.tareas.length;
  const hechas = p.tareas.filter((t) => t.estado === 'hecha').length;
  return {
    id: Number(p.id),
    nombre: p.nombre,
    area_id: Number(p.area_id),
    area_nombre: p.area.nombre,
    estado: p.estado,
    descripcion: p.descripcion,
    avance: avancePct(hechas, total),
    tareas_total: total,
    tareas_hechas: hechas,
    tareas: p.tareas.map(serializarTarea),
    avances: p.avances.map((a) => ({ id: Number(a.id), fecha: iso(a.fecha), nota: a.nota })),
  };
}

export async function agregarAvance(proyectoId: bigint, nota: string, fecha?: string) {
  const existe = await prisma.proyectos.findUnique({ where: { id: proyectoId } });
  if (!existe) throw new HttpError(404, 'Proyecto no encontrado');
  const a = await prisma.proyecto_avances.create({
    data: { proyecto_id: proyectoId, nota, fecha: fechaDate(fecha ?? hoyMX()) },
  });
  return { id: Number(a.id) };
}

/** % de tareas hechas de un proyecto (para vincular a un objetivo). */
export async function avanceProyecto(proyectoId: bigint): Promise<number> {
  const tareas = await prisma.tareas.findMany({ where: { proyecto_id: proyectoId }, select: { estado: true } });
  const hechas = tareas.filter((t) => t.estado === 'hecha').length;
  return avancePct(hechas, tareas.length);
}
