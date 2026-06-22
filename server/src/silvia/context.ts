import { prisma } from '../db.js';
import { dashboard as finanzasDashboard } from '../finanzas/service.js';
import { patrimonioActual } from '../patrimonio/service.js';
import { tendenciaPeso } from '../salud/service.js';
import { tracker } from '../habitos/service.js';
import { listar as listarObjetivos } from '../objetivos/service.js';

const mxn = (n: number | null | undefined) =>
  n == null ? 's/d' : n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

/**
 * Reúne los KPIs reales de la vida del usuario para dárselos a Silvia como contexto.
 * Prioriza finanzas y hábitos (las prioridades declaradas). No inventa: si falta, lo dice.
 */
export async function contextoVida(): Promise<string> {
  const partes: string[] = [];

  // --- Finanzas (mes actual) ---
  try {
    const f = await finanzasDashboard();
    partes.push(
      `Finanzas (mes ${f.mes}): ingresos ${mxn(f.resumen.ingresos)}, gastos ${mxn(f.resumen.gastos)}, ` +
        `flujo ${mxn(f.resumen.flujo)}, tasa de ahorro ${pct(f.resumen.tasa_ahorro)}. ` +
        `Líquido ${mxn(f.total_liquido)}, por cobrar ${mxn(f.por_cobrar)}, deudas ${mxn(f.deudas)}.`,
    );
    const excedidos = f.presupuestos.filter((p) => p.nivel !== 'ok');
    if (excedidos.length) {
      partes.push('Presupuestos en alerta: ' + excedidos.map((p) => `${p.etiqueta} (${pct(p.ratio)})`).join(', ') + '.');
    }
  } catch {
    partes.push('Finanzas: sin datos suficientes este mes.');
  }

  // --- Patrimonio ---
  try {
    const p = await patrimonioActual();
    partes.push(`Patrimonio neto actual: ${mxn(p.patrimonio_neto)} (activos ${mxn(p.total_activos)}, pasivos ${mxn(p.total_pasivos)}, inversiones ${mxn(p.desglose.inversiones_mxn)}).`);
  } catch {
    /* sin patrimonio */
  }

  // --- Peso ---
  try {
    const peso = await tendenciaPeso(30);
    if (peso.ultimo) {
      partes.push(`Peso: último ${peso.ultimo.peso} kg (${peso.ultimo.fecha})` + (peso.variacion_periodo != null ? `, variación del periodo ${peso.variacion_periodo} kg.` : '.'));
    }
  } catch {
    /* sin peso */
  }

  // --- Hábitos ---
  try {
    const t = await tracker();
    if (t.habitos.length) {
      const filas = t.habitos.map((h) => `  ${h.nombre}: ${h.dias_semana}/${h.meta_semanal} esta semana (racha ${h.racha})`);
      partes.push('Hábitos (semana actual):\n' + filas.join('\n'));
    }
  } catch {
    /* sin hábitos */
  }

  // --- Objetivos ---
  try {
    const objs = await listarObjetivos();
    if (objs.length) {
      const filas = objs.map((o) => `  ${o.nombre} (${o.estado}): ${pct(o.progreso)} de ${o.meta_valor}${o.unidad ? ' ' + o.unidad : ''}`);
      partes.push('Objetivos:\n' + filas.join('\n'));
    }
  } catch {
    /* sin objetivos */
  }

  // --- Tareas pendientes ---
  try {
    const pend = await prisma.tareas.count({ where: { estado: 'pendiente' } });
    partes.push(`Tareas pendientes: ${pend}.`);
  } catch {
    /* sin tareas */
  }

  return partes.join('\n\n');
}

/** Catálogo (nombres→ids) para la captura asistida: cuentas, categorías, áreas, hábitos, tipos de entrenamiento. */
export async function catalogoCaptura() {
  const [cuentas, categorias, areas, habitos, tipos] = await Promise.all([
    prisma.cuentas.findMany({ where: { activo: true }, select: { id: true, nombre: true, es_central: true } }),
    prisma.categorias.findMany({ where: { activo: true }, select: { id: true, nombre: true, clase: true } }),
    prisma.areas.findMany({ where: { activo: true }, select: { id: true, nombre: true } }),
    prisma.habitos.findMany({ where: { activo: true }, select: { id: true, nombre: true } }),
    prisma.tipos_entrenamiento.findMany({ select: { id: true, nombre: true } }),
  ]);
  return {
    cuentas: cuentas.map((c) => ({ id: Number(c.id), nombre: c.nombre, es_central: c.es_central })),
    categorias: categorias.map((c) => ({ id: Number(c.id), nombre: c.nombre, clase: c.clase })),
    areas: areas.map((a) => ({ id: Number(a.id), nombre: a.nombre })),
    habitos: habitos.map((h) => ({ id: Number(h.id), nombre: h.nombre })),
    tipos_entrenamiento: tipos.map((t) => ({ id: Number(t.id), nombre: t.nombre })),
  };
}
