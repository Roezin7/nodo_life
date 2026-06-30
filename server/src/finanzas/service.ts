import type { TipoMovimiento } from '@prisma/client';
import { prisma } from '../db.js';
import { num0 } from '../lib/num.js';
import { HttpError } from '../middleware/error.js';
import { fechaDate, iso, hoyMX, lunesDe } from '../lib/fecha.js';
import { valorPortafolioMXN } from '../inversiones/service.js';
import {
  redondear,
  saldosPorCuenta,
  resumenMes,
  estadoPresupuesto,
  type MovSaldo,
} from './logic.js';

// ---------------------------------------------------------------------------
//  Referencias para la UI (cuentas con saldo, categorías, tipos de cuenta)
// ---------------------------------------------------------------------------
export async function referencias() {
  const [tipos, cuentas, categorias, saldos] = await Promise.all([
    prisma.tipos_cuenta.findMany({ orderBy: { id: 'asc' } }),
    prisma.cuentas.findMany({ where: { activo: true }, orderBy: { id: 'asc' } }),
    prisma.categorias.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
    saldosActuales(),
  ]);
  const saldoPorId = new Map(saldos.map((s) => [s.cuenta_id, s.saldo]));
  return {
    tipos_cuenta: tipos.map((t) => ({ id: Number(t.id), nombre: t.nombre })),
    cuentas: cuentas.map((c) => ({
      id: Number(c.id),
      nombre: c.nombre,
      tipo_id: Number(c.tipo_id),
      moneda: c.moneda,
      es_central: c.es_central,
      saldo_inicial: num0(c.saldo_inicial),
      saldo: saldoPorId.get(Number(c.id)) ?? num0(c.saldo_inicial),
    })),
    categorias: categorias.map((c) => ({
      id: Number(c.id),
      nombre: c.nombre,
      clase: c.clase,
      area_id: c.area_id ? Number(c.area_id) : null,
    })),
  };
}

// ---------------------------------------------------------------------------
//  Saldos actuales por cuenta (saldo_inicial + Σ movimientos)
// ---------------------------------------------------------------------------
export async function saldosActuales() {
  const [cuentas, movs] = await Promise.all([
    prisma.cuentas.findMany({ where: { activo: true } }),
    prisma.movimientos.findMany({
      select: { tipo: true, monto: true, cuenta_origen_id: true, cuenta_destino_id: true },
    }),
  ]);
  const iniciales: Record<number, number> = {};
  for (const c of cuentas) iniciales[Number(c.id)] = num0(c.saldo_inicial);
  const movSaldo: MovSaldo[] = movs.map((m) => ({
    tipo: m.tipo,
    monto: num0(m.monto),
    cuenta_origen_id: m.cuenta_origen_id ? Number(m.cuenta_origen_id) : null,
    cuenta_destino_id: m.cuenta_destino_id ? Number(m.cuenta_destino_id) : null,
  }));
  const saldos = saldosPorCuenta(iniciales, movSaldo);
  return cuentas.map((c) => ({
    cuenta_id: Number(c.id),
    nombre: c.nombre,
    tipo_id: Number(c.tipo_id),
    es_central: c.es_central,
    saldo: saldos[Number(c.id)] ?? 0,
  }));
}

/** Total líquido (suma de saldos de todas las cuentas activas, en MXN nominal). */
export async function totalLiquido(): Promise<number> {
  const s = await saldosActuales();
  return redondear(s.reduce((a, x) => a + x.saldo, 0));
}

/** Totales de por cobrar (activo) y deudas (pasivo) pendientes. */
export async function totalesCobrarDeudas() {
  const [cobrar, deudas] = await Promise.all([
    prisma.por_cobrar.aggregate({ where: { estado: 'pendiente' }, _sum: { monto: true } }),
    prisma.deudas.aggregate({ where: { estado: 'pendiente' }, _sum: { monto: true } }),
  ]);
  return {
    por_cobrar: num0(cobrar._sum.monto),
    deudas: num0(deudas._sum.monto),
  };
}

// ---------------------------------------------------------------------------
//  Rango de un periodo (mes o semana) → fechas [desde, hasta)
// ---------------------------------------------------------------------------
export type Periodo = 'mes' | 'semana';

export function rangoPeriodo(periodo: Periodo, ref?: string): { desde: Date; hasta: Date; etiqueta: string; ref: string } {
  if (periodo === 'semana') {
    const dia = ref && /^\d{4}-\d{2}-\d{2}$/.test(ref) ? ref : hoyMX();
    const inicio = lunesDe(dia);
    const desde = fechaDate(inicio);
    const hasta = new Date(desde);
    hasta.setUTCDate(hasta.getUTCDate() + 7);
    return { desde, hasta, etiqueta: `Semana del ${inicio}`, ref: inicio };
  }
  const mes = ref && /^\d{4}-\d{2}$/.test(ref) ? ref : hoyMX().slice(0, 7);
  const desde = fechaDate(mes + '-01');
  const hasta = new Date(desde);
  hasta.setUTCMonth(hasta.getUTCMonth() + 1);
  return { desde, hasta, etiqueta: mes, ref: mes };
}

// ---------------------------------------------------------------------------
//  Movimientos
// ---------------------------------------------------------------------------
export interface MovimientoInput {
  tipo: TipoMovimiento;
  monto: number;
  fecha?: string;
  cuenta_origen_id?: number | null;
  cuenta_destino_id?: number | null;
  categoria_id?: number | null;
  area_id?: number | null;
  descripcion?: string;
}

export async function crearMovimiento(m: MovimientoInput) {
  if (m.monto <= 0) throw new HttpError(400, 'El monto debe ser mayor a cero');
  if (m.tipo === 'ingreso' && m.cuenta_destino_id == null) throw new HttpError(400, 'El ingreso requiere cuenta destino');
  if (m.tipo === 'gasto' && m.cuenta_origen_id == null) throw new HttpError(400, 'El gasto requiere cuenta origen');
  if (m.tipo === 'transferencia' && (m.cuenta_origen_id == null || m.cuenta_destino_id == null)) {
    throw new HttpError(400, 'La transferencia requiere cuenta origen y destino');
  }

  // Validar cuentas referenciadas.
  const ids = [m.cuenta_origen_id, m.cuenta_destino_id].filter((x): x is number => x != null);
  if (ids.length) {
    const n = await prisma.cuentas.count({ where: { id: { in: ids.map(BigInt) } } });
    if (n !== new Set(ids).size) throw new HttpError(400, 'Cuenta inválida');
  }

  const creado = await prisma.movimientos.create({
    data: {
      fecha: fechaDate(m.fecha ?? hoyMX()),
      tipo: m.tipo,
      monto: m.monto,
      cuenta_origen_id: m.cuenta_origen_id != null ? BigInt(m.cuenta_origen_id) : null,
      cuenta_destino_id: m.cuenta_destino_id != null ? BigInt(m.cuenta_destino_id) : null,
      categoria_id: m.categoria_id != null ? BigInt(m.categoria_id) : null,
      area_id: m.area_id != null ? BigInt(m.area_id) : null,
      descripcion: m.descripcion ?? null,
    },
  });
  return { id: Number(creado.id) };
}

export async function editarMovimiento(idMov: bigint, m: MovimientoInput) {
  const existe = await prisma.movimientos.findUnique({ where: { id: idMov } });
  if (!existe) throw new HttpError(404, 'Movimiento no encontrado');
  if (m.monto <= 0) throw new HttpError(400, 'El monto debe ser mayor a cero');
  if (m.tipo === 'ingreso' && m.cuenta_destino_id == null) throw new HttpError(400, 'El ingreso requiere cuenta destino');
  if (m.tipo === 'gasto' && m.cuenta_origen_id == null) throw new HttpError(400, 'El gasto requiere cuenta origen');
  if (m.tipo === 'transferencia' && (m.cuenta_origen_id == null || m.cuenta_destino_id == null)) {
    throw new HttpError(400, 'La transferencia requiere cuenta origen y destino');
  }
  const ids = [m.cuenta_origen_id, m.cuenta_destino_id].filter((x): x is number => x != null);
  if (ids.length) {
    const n = await prisma.cuentas.count({ where: { id: { in: ids.map(BigInt) } } });
    if (n !== new Set(ids).size) throw new HttpError(400, 'Cuenta inválida');
  }
  await prisma.movimientos.update({
    where: { id: idMov },
    data: {
      fecha: fechaDate(m.fecha ?? iso(existe.fecha)),
      tipo: m.tipo,
      monto: m.monto,
      cuenta_origen_id: m.cuenta_origen_id != null ? BigInt(m.cuenta_origen_id) : null,
      cuenta_destino_id: m.cuenta_destino_id != null ? BigInt(m.cuenta_destino_id) : null,
      categoria_id: m.categoria_id != null ? BigInt(m.categoria_id) : null,
      area_id: m.area_id != null ? BigInt(m.area_id) : null,
      descripcion: m.descripcion ?? null,
    },
  });
  return { ok: true };
}

/** Lista movimientos de un periodo (mes o semana) con filtros opcionales por área/categoría. */
export async function listarMovimientos(opts: { periodo?: Periodo; ref?: string; area_id?: number; categoria_id?: number } = {}) {
  const { desde, hasta } = rangoPeriodo(opts.periodo ?? 'mes', opts.ref);
  const filtros = opts;
  const movs = await prisma.movimientos.findMany({
    where: {
      fecha: { gte: desde, lt: hasta },
      area_id: filtros.area_id != null ? BigInt(filtros.area_id) : undefined,
      categoria_id: filtros.categoria_id != null ? BigInt(filtros.categoria_id) : undefined,
    },
    orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
  });
  return movs.map((m) => ({
    id: Number(m.id),
    fecha: iso(m.fecha),
    tipo: m.tipo,
    monto: num0(m.monto),
    cuenta_origen_id: m.cuenta_origen_id ? Number(m.cuenta_origen_id) : null,
    cuenta_destino_id: m.cuenta_destino_id ? Number(m.cuenta_destino_id) : null,
    categoria_id: m.categoria_id ? Number(m.categoria_id) : null,
    area_id: m.area_id ? Number(m.area_id) : null,
    descripcion: m.descripcion,
  }));
}

export async function borrarMovimiento(id: bigint) {
  const mov = await prisma.movimientos.findUnique({ where: { id } });
  if (!mov) throw new HttpError(404, 'Movimiento no encontrado');
  await prisma.movimientos.delete({ where: { id } });
  return { ok: true };
}

// ---------------------------------------------------------------------------
//  Dashboard de Dinero (KPIs del mes)
// ---------------------------------------------------------------------------
export async function dashboard(opts: { periodo?: Periodo; ref?: string } = {}) {
  const periodo = opts.periodo ?? 'mes';
  const rango = rangoPeriodo(periodo, opts.ref);
  const { desde, hasta } = rango;

  const [movs, presupuestos, categorias, areas, saldos, cobrarDeudas, inversiones] = await Promise.all([
    prisma.movimientos.findMany({ where: { fecha: { gte: desde, lt: hasta } } }),
    prisma.presupuestos.findMany(),
    prisma.categorias.findMany({ where: { activo: true } }),
    prisma.areas.findMany({ where: { activo: true }, orderBy: { orden: 'asc' } }),
    saldosActuales(),
    totalesCobrarDeudas(),
    valorPortafolioMXN().catch(() => 0), // las inversiones dependen de red; no deben tumbar el dashboard
  ]);

  const ingresos = redondear(movs.filter((m) => m.tipo === 'ingreso').reduce((a, m) => a + num0(m.monto), 0));
  const gastos = redondear(movs.filter((m) => m.tipo === 'gasto').reduce((a, m) => a + num0(m.monto), 0));
  const mes_resumen = resumenMes(ingresos, gastos);

  // Gasto por categoría y por área (solo gastos).
  const gastoPorCategoria = new Map<number, number>();
  const gastoPorArea = new Map<number, number>();
  for (const m of movs) {
    if (m.tipo !== 'gasto') continue;
    if (m.categoria_id) gastoPorCategoria.set(Number(m.categoria_id), redondear((gastoPorCategoria.get(Number(m.categoria_id)) ?? 0) + num0(m.monto)));
    if (m.area_id) gastoPorArea.set(Number(m.area_id), redondear((gastoPorArea.get(Number(m.area_id)) ?? 0) + num0(m.monto)));
  }

  const catNombre = new Map(categorias.map((c) => [Number(c.id), c.nombre]));

  // Presupuestos vs gasto del mes (los límites son mensuales; solo en vista de mes).
  const presupuestoEstado = periodo === 'semana' ? [] : presupuestos.map((p) => {
    const gastado = p.categoria_id
      ? gastoPorCategoria.get(Number(p.categoria_id)) ?? 0
      : p.area_id
        ? gastoPorArea.get(Number(p.area_id)) ?? 0
        : 0;
    return {
      id: Number(p.id),
      categoria_id: p.categoria_id ? Number(p.categoria_id) : null,
      area_id: p.area_id ? Number(p.area_id) : null,
      etiqueta: p.categoria_id ? (catNombre.get(Number(p.categoria_id)) ?? 'Categoría') : 'Área',
      ...estadoPresupuesto(gastado, num0(p.monto_limite)),
    };
  });

  const total_liquido = redondear(saldos.reduce((a, s) => a + s.saldo, 0));

  return {
    periodo,
    ref: rango.ref,
    etiqueta: rango.etiqueta,
    mes: rango.ref,
    resumen: mes_resumen,
    saldos,
    total_liquido,
    por_cobrar: cobrarDeudas.por_cobrar,
    deudas: cobrarDeudas.deudas,
    inversiones,
    // patrimonio neto "líquido" (sin inversiones): el módulo Patrimonio agrega la valuación.
    patrimonio_liquido: redondear(total_liquido + cobrarDeudas.por_cobrar - cobrarDeudas.deudas),
    // capital proyectado: efectivo + flujo futuro por cobrar − deudas futuras + inversiones (excluye activos físicos).
    capital_proyectado: redondear(total_liquido + cobrarDeudas.por_cobrar - cobrarDeudas.deudas + inversiones),
    gasto_por_categoria: [...gastoPorCategoria.entries()].map(([id, monto]) => ({ categoria_id: id, nombre: catNombre.get(id) ?? '—', monto })),
    gasto_por_area: areas.map((a) => ({ area_id: Number(a.id), nombre: a.nombre, color: a.color, monto: gastoPorArea.get(Number(a.id)) ?? 0 })),
    presupuestos: presupuestoEstado,
  };
}

// ---------------------------------------------------------------------------
//  Configuración: tipos de cuenta, cuentas, categorías, presupuestos
// ---------------------------------------------------------------------------
export async function crearTipoCuenta(nombre: string) {
  const t = await prisma.tipos_cuenta.create({ data: { nombre } });
  return { id: Number(t.id) };
}

export async function crearCuenta(data: { nombre: string; tipo_id: number; moneda?: string; saldo_inicial?: number; es_central?: boolean }) {
  const c = await prisma.cuentas.create({
    data: {
      nombre: data.nombre,
      tipo_id: BigInt(data.tipo_id),
      moneda: data.moneda ?? 'MXN',
      saldo_inicial: data.saldo_inicial ?? 0,
      es_central: data.es_central ?? false,
    },
  });
  return { id: Number(c.id) };
}

export async function editarCuenta(id: bigint, data: { nombre?: string; tipo_id?: number; moneda?: string; saldo_inicial?: number; es_central?: boolean; activo?: boolean }) {
  const existe = await prisma.cuentas.findUnique({ where: { id } });
  if (!existe) throw new HttpError(404, 'Cuenta no encontrada');
  await prisma.cuentas.update({
    where: { id },
    data: {
      nombre: data.nombre,
      tipo_id: data.tipo_id != null ? BigInt(data.tipo_id) : undefined,
      moneda: data.moneda,
      saldo_inicial: data.saldo_inicial,
      es_central: data.es_central,
      activo: data.activo,
    },
  });
  return { ok: true };
}

export async function crearCategoria(data: { nombre: string; clase: 'ingreso' | 'gasto'; area_id?: number | null }) {
  const c = await prisma.categorias.create({
    data: { nombre: data.nombre, clase: data.clase, area_id: data.area_id != null ? BigInt(data.area_id) : null },
  });
  return { id: Number(c.id) };
}

export async function editarCategoria(id: bigint, data: { nombre?: string; area_id?: number | null; activo?: boolean }) {
  const existe = await prisma.categorias.findUnique({ where: { id } });
  if (!existe) throw new HttpError(404, 'Categoría no encontrada');
  await prisma.categorias.update({
    where: { id },
    data: {
      nombre: data.nombre,
      area_id: data.area_id === undefined ? undefined : data.area_id != null ? BigInt(data.area_id) : null,
      activo: data.activo,
    },
  });
  return { ok: true };
}

export async function listarPresupuestos() {
  const ps = await prisma.presupuestos.findMany();
  return ps.map((p) => ({
    id: Number(p.id),
    categoria_id: p.categoria_id ? Number(p.categoria_id) : null,
    area_id: p.area_id ? Number(p.area_id) : null,
    periodo: p.periodo,
    monto_limite: num0(p.monto_limite),
  }));
}

export async function crearPresupuesto(data: { categoria_id?: number | null; area_id?: number | null; monto_limite: number }) {
  const p = await prisma.presupuestos.create({
    data: {
      categoria_id: data.categoria_id != null ? BigInt(data.categoria_id) : null,
      area_id: data.area_id != null ? BigInt(data.area_id) : null,
      monto_limite: data.monto_limite,
    },
  });
  return { id: Number(p.id) };
}

export async function borrarPresupuesto(id: bigint) {
  const existe = await prisma.presupuestos.findUnique({ where: { id } });
  if (!existe) throw new HttpError(404, 'Presupuesto no encontrado');
  await prisma.presupuestos.delete({ where: { id } });
  return { ok: true };
}

// ---------------------------------------------------------------------------
//  Por cobrar / Deudas
// ---------------------------------------------------------------------------
export async function listarPorCobrar() {
  const filas = await prisma.por_cobrar.findMany({ orderBy: [{ estado: 'asc' }, { fecha: 'desc' }] });
  return filas.map((f) => ({ id: Number(f.id), descripcion: f.descripcion, deudor: f.deudor, monto: num0(f.monto), fecha: iso(f.fecha), estado: f.estado }));
}

export async function crearPorCobrar(data: { descripcion: string; deudor?: string; monto: number; fecha?: string }) {
  const f = await prisma.por_cobrar.create({
    data: { descripcion: data.descripcion, deudor: data.deudor ?? null, monto: data.monto, fecha: fechaDate(data.fecha ?? hoyMX()) },
  });
  return { id: Number(f.id) };
}

export async function actualizarPorCobrar(id: bigint, data: { estado?: 'pendiente' | 'cobrado'; monto?: number; descripcion?: string; deudor?: string | null; fecha?: string }) {
  const existe = await prisma.por_cobrar.findUnique({ where: { id } });
  if (!existe) throw new HttpError(404, 'Registro no encontrado');
  await prisma.por_cobrar.update({
    where: { id },
    data: {
      estado: data.estado,
      monto: data.monto,
      descripcion: data.descripcion,
      deudor: data.deudor === undefined ? undefined : data.deudor,
      fecha: data.fecha ? fechaDate(data.fecha) : undefined,
    },
  });
  return { ok: true };
}

export async function borrarPorCobrar(id: bigint) {
  const existe = await prisma.por_cobrar.findUnique({ where: { id } });
  if (!existe) throw new HttpError(404, 'Registro no encontrado');
  await prisma.por_cobrar.delete({ where: { id } });
  return { ok: true };
}

export async function listarDeudas() {
  const filas = await prisma.deudas.findMany({ orderBy: [{ estado: 'asc' }, { fecha: 'desc' }] });
  return filas.map((f) => ({ id: Number(f.id), descripcion: f.descripcion, acreedor: f.acreedor, monto: num0(f.monto), fecha: iso(f.fecha), estado: f.estado }));
}

export async function crearDeuda(data: { descripcion: string; acreedor?: string; monto: number; fecha?: string }) {
  const f = await prisma.deudas.create({
    data: { descripcion: data.descripcion, acreedor: data.acreedor ?? null, monto: data.monto, fecha: fechaDate(data.fecha ?? hoyMX()) },
  });
  return { id: Number(f.id) };
}

export async function actualizarDeuda(id: bigint, data: { estado?: 'pendiente' | 'pagado'; monto?: number; descripcion?: string; acreedor?: string | null; fecha?: string }) {
  const existe = await prisma.deudas.findUnique({ where: { id } });
  if (!existe) throw new HttpError(404, 'Registro no encontrado');
  await prisma.deudas.update({
    where: { id },
    data: {
      estado: data.estado,
      monto: data.monto,
      descripcion: data.descripcion,
      acreedor: data.acreedor === undefined ? undefined : data.acreedor,
      fecha: data.fecha ? fechaDate(data.fecha) : undefined,
    },
  });
  return { ok: true };
}

export async function borrarDeuda(id: bigint) {
  const existe = await prisma.deudas.findUnique({ where: { id } });
  if (!existe) throw new HttpError(404, 'Registro no encontrado');
  await prisma.deudas.delete({ where: { id } });
  return { ok: true };
}
