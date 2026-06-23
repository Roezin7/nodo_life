import { prisma } from '../db.js';
import { num0 } from '../lib/num.js';
import { HttpError } from '../middleware/error.js';
import { iso, fechaDate, hoyMX } from '../lib/fecha.js';
import { mediaMovil, variacion } from './logic.js';

// ---------------------------------------------------------------------------
//  Peso (registro diario + tendencia con media móvil 7 días)
// ---------------------------------------------------------------------------
export async function registrarPeso(data: { fecha?: string; hora?: string; peso: number }) {
  const fecha = fechaDate(data.fecha ?? hoyMX());
  const r = await prisma.peso_registros.upsert({
    where: { fecha },
    update: { peso: data.peso, hora: data.hora ?? null },
    create: { fecha, peso: data.peso, hora: data.hora ?? null },
  });
  return { id: Number(r.id) };
}

export async function tendenciaPeso(dias = 120) {
  const registros = await prisma.peso_registros.findMany({ orderBy: { fecha: 'asc' } });
  const puntos = registros.map((r) => ({ fecha: iso(r.fecha), peso: num0(r.peso) }));
  const recientes = puntos.slice(-dias);
  const serie = mediaMovil(recientes, 7);
  const ult = registros[registros.length - 1];
  return {
    serie,
    ultimo: ult ? { fecha: iso(ult.fecha), peso: num0(ult.peso) } : null,
    variacion_periodo: variacion(recientes),
  };
}

export async function borrarPeso(id: bigint) {
  const existe = await prisma.peso_registros.findUnique({ where: { id } });
  if (!existe) throw new HttpError(404, 'Registro no encontrado');
  await prisma.peso_registros.delete({ where: { id } });
  return { ok: true };
}

// ---------------------------------------------------------------------------
//  Etapa (déficit/volumen/mantenimiento) — opcional, simple
// ---------------------------------------------------------------------------
export async function getEtapa() {
  const e = await prisma.etapa_actual.findFirst({ orderBy: { id: 'desc' } });
  return e ? { id: Number(e.id), tipo: e.tipo, desde: e.desde ? iso(e.desde) : null, nota: e.nota } : null;
}

export async function setEtapa(data: { tipo?: 'deficit' | 'volumen' | 'mantenimiento' | null; desde?: string; nota?: string }) {
  const e = await prisma.etapa_actual.create({
    data: { tipo: data.tipo ?? null, desde: data.desde ? fechaDate(data.desde) : fechaDate(hoyMX()), nota: data.nota ?? null },
  });
  return { id: Number(e.id) };
}

// ---------------------------------------------------------------------------
//  Entrenamientos por tipo
// ---------------------------------------------------------------------------
export async function tiposEntrenamiento() {
  const tipos = await prisma.tipos_entrenamiento.findMany({ orderBy: { id: 'asc' } });
  return tipos.map((t) => ({ id: Number(t.id), nombre: t.nombre }));
}

export async function crearTipoEntrenamiento(nombre: string) {
  const t = await prisma.tipos_entrenamiento.create({ data: { nombre } });
  return { id: Number(t.id) };
}

export interface SerieInput {
  ejercicio: string;
  series?: number;
  reps?: number;
  peso?: number;
}

export interface EntrenamientoInput {
  fecha?: string;
  tipo_id: number;
  duracion_min?: number;
  notas?: string;
  metricas?: Record<string, unknown>;
  series?: SerieInput[]; // solo Pesas
}

export async function crearEntrenamiento(e: EntrenamientoInput) {
  const tipo = await prisma.tipos_entrenamiento.findUnique({ where: { id: BigInt(e.tipo_id) } });
  if (!tipo) throw new HttpError(400, 'Tipo de entrenamiento inválido');
  const creado = await prisma.entrenamientos.create({
    data: {
      fecha: fechaDate(e.fecha ?? hoyMX()),
      tipo_id: BigInt(e.tipo_id),
      duracion_min: e.duracion_min ?? null,
      notas: e.notas ?? null,
      metricas_json: e.metricas ? (e.metricas as object) : undefined,
      series: e.series && e.series.length
        ? {
            create: e.series.map((s) => ({
              ejercicio: s.ejercicio,
              series: s.series ?? null,
              reps: s.reps ?? null,
              peso: s.peso ?? null,
            })),
          }
        : undefined,
    },
  });
  return { id: Number(creado.id) };
}

export async function listarEntrenamientos(tipoId?: number) {
  const ents = await prisma.entrenamientos.findMany({
    where: tipoId != null ? { tipo_id: BigInt(tipoId) } : {},
    orderBy: { fecha: 'desc' },
    include: { series: true, tipo: true },
    take: 200,
  });
  return ents.map((e) => ({
    id: Number(e.id),
    fecha: iso(e.fecha),
    tipo_id: Number(e.tipo_id),
    tipo_nombre: e.tipo.nombre,
    duracion_min: e.duracion_min,
    notas: e.notas,
    metricas: e.metricas_json,
    series: e.series.map((s) => ({
      id: Number(s.id),
      ejercicio: s.ejercicio,
      series: s.series,
      reps: s.reps,
      peso: s.peso != null ? num0(s.peso) : null,
    })),
  }));
}

/**
 * Calendario mensual de entrenamientos: para cada día del mes (YYYY-MM) indica
 * si hubo entrenamiento y de qué tipos, para pintar un mapa cuadriculado.
 */
export async function calendarioEntrenamientos(mes: string) {
  const desde = fechaDate(mes + '-01');
  const hasta = new Date(desde);
  hasta.setUTCMonth(hasta.getUTCMonth() + 1);
  const ents = await prisma.entrenamientos.findMany({
    where: { fecha: { gte: desde, lt: hasta } },
    orderBy: { fecha: 'asc' },
    include: { tipo: true },
  });

  // Mapa fecha -> tipos entrenados ese día.
  const porDia = new Map<string, Set<string>>();
  for (const e of ents) {
    const f = iso(e.fecha);
    (porDia.get(f) ?? porDia.set(f, new Set()).get(f)!).add(e.tipo.nombre);
  }

  const diasMes = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth() + 1, 0)).getUTCDate();
  const dias: { fecha: string; entrenado: boolean; tipos: string[] }[] = [];
  for (let i = 1; i <= diasMes; i++) {
    const f = iso(new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), i)));
    const tipos = porDia.get(f);
    dias.push({ fecha: f, entrenado: !!tipos, tipos: tipos ? [...tipos] : [] });
  }
  // Día de la semana del 1° (0=lunes … 6=domingo) para alinear la cuadrícula.
  const dow = (desde.getUTCDay() + 6) % 7;
  return { mes, dias, offset_inicial: dow, total_entrenados: porDia.size };
}

export async function borrarEntrenamiento(id: bigint) {
  const existe = await prisma.entrenamientos.findUnique({ where: { id } });
  if (!existe) throw new HttpError(404, 'Entrenamiento no encontrado');
  await prisma.entrenamientos.delete({ where: { id } });
  return { ok: true };
}

/**
 * Progresión de un tipo. Para Pesas: peso máximo por ejercicio en el tiempo.
 * Para Correr/HIIT u otros: serie de los campos numéricos de metricas_json.
 */
export async function progresion(tipoId: number) {
  const ents = await prisma.entrenamientos.findMany({
    where: { tipo_id: BigInt(tipoId) },
    orderBy: { fecha: 'asc' },
    include: { series: true, tipo: true },
  });
  if (ents.length === 0) return { tipo_id: tipoId, nombre: null, por_ejercicio: {}, serie_metricas: [] };

  // Pesas: peso máximo por ejercicio por fecha.
  const porEjercicio: Record<string, { fecha: string; peso: number }[]> = {};
  for (const e of ents) {
    for (const s of e.series) {
      if (s.peso == null) continue;
      (porEjercicio[s.ejercicio] ??= []).push({ fecha: iso(e.fecha), peso: num0(s.peso) });
    }
  }

  // Métricas numéricas (Correr/HIIT): { fecha, ...campos numéricos }.
  const serieMetricas = ents
    .filter((e) => e.metricas_json && typeof e.metricas_json === 'object')
    .map((e) => {
      const m = e.metricas_json as Record<string, unknown>;
      const nums: Record<string, number> = {};
      for (const [k, v] of Object.entries(m)) if (typeof v === 'number') nums[k] = v;
      return { fecha: iso(e.fecha), ...nums };
    });

  return { tipo_id: tipoId, nombre: ents[0]!.tipo.nombre, por_ejercicio: porEjercicio, serie_metricas: serieMetricas };
}
