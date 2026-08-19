import { createHash, randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { HttpError } from '../middleware/error.js';
import { fechaDate, hoyMX } from '../lib/fecha.js';
import { cifrar, descifrar } from './crypto.js';
import { intercambiarCodigo, renovarToken, schwabDisponible, schwabGet, urlAutorizacion } from './client.js';

const PROVEEDOR = 'schwab';
let sincronizacionEnCurso = false;

type TokenData = { access_token: string; refresh_token?: string; expires_in: number; refresh_token_expires_in?: number; scope?: string };
type CuentaNumeros = { accountNumber?: string; hashValue?: string };
type CuentaApi = { securitiesAccount?: Record<string, unknown> };

function numero(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function texto(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function fechaApi(value: unknown) {
  const raw = texto(value);
  const match = raw?.match(/^\d{4}-\d{2}-\d{2}/);
  return fechaDate(match?.[0] ?? hoyMX());
}

function fechaHoraApi(value: unknown) {
  const raw = texto(value);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function datosOperacion(t: Record<string, unknown>, item: Record<string, unknown>, instrument: Record<string, unknown>) {
  // Conservamos lo necesario para auditar la importación, sin guardar respuestas
  // completas de Schwab que podrían incluir datos de cuenta no necesarios.
  return JSON.parse(JSON.stringify({
    activityType: t.activityType,
    transactionId: t.transactionId,
    transactionDate: t.transactionDate,
    settlementDate: t.settlementDate,
    description: t.description,
    netAmount: t.netAmount,
    fees: t.fees,
    transactionItem: {
      amount: item.amount,
      quantity: item.quantity,
      price: item.price,
      instruction: item.instruction,
      instrument: {
        symbol: instrument.symbol,
        description: instrument.description,
        assetType: instrument.assetType,
        currency: instrument.currency,
      },
    },
  }));
}

async function conexion() {
  return prisma.broker_conexiones.upsert({
    where: { proveedor: PROVEEDOR },
    update: {},
    create: { proveedor: PROVEEDOR },
  });
}

function expiracion(segundos: number | undefined) {
  return segundos && segundos > 0 ? new Date(Date.now() + segundos * 1000) : null;
}

async function guardarTokens(id: bigint, token: TokenData, conservarRefresh = true) {
  const actual = await prisma.broker_conexiones.findUnique({ where: { id }, select: { refresh_token_enc: true } });
  await prisma.broker_conexiones.update({
    where: { id },
    data: {
      estado: 'conectada',
      access_token_enc: cifrar(token.access_token),
      refresh_token_enc: token.refresh_token ? cifrar(token.refresh_token) : (conservarRefresh ? actual?.refresh_token_enc : null),
      access_expira_at: expiracion(token.expires_in),
      refresh_expira_at: expiracion(token.refresh_token_expires_in),
      scope: token.scope ?? undefined,
      ultimo_error: null,
    },
  });
}

async function tokenValido(c: { id: bigint; access_token_enc: string | null; refresh_token_enc: string | null; access_expira_at: Date | null }) {
  if (c.access_token_enc && c.access_expira_at && c.access_expira_at.getTime() > Date.now() + 60_000) {
    return descifrar(c.access_token_enc);
  }
  if (!c.refresh_token_enc) throw new HttpError(401, 'La conexión Schwab expiró; vuelve a conectarla.');
  const token = await renovarToken(descifrar(c.refresh_token_enc));
  await guardarTokens(c.id, token);
  return token.access_token;
}

export function estado() {
  return prisma.broker_conexiones.findUnique({
    where: { proveedor: PROVEEDOR },
    select: {
      estado: true, alias: true, ultimo_sync_at: true, ultimo_error: true,
      cuentas: { where: { activo: true }, select: { id: true, cuenta_mascara: true, tipo: true, moneda: true, saldo_efectivo: true, valor_cuenta: true, ultimo_sync_at: true }, orderBy: { id: 'asc' } },
    },
  }).then((c) => ({
    disponible: schwabDisponible(),
    conectada: c?.estado === 'conectada',
    estado: c?.estado ?? 'no_configurada',
    ultimo_sync_at: c?.ultimo_sync_at?.toISOString() ?? null,
    ultimo_error: c?.ultimo_error ?? null,
    cuentas: c?.cuentas.map((x) => ({ ...x, id: Number(x.id), saldo_efectivo: x.saldo_efectivo == null ? null : Number(x.saldo_efectivo), valor_cuenta: x.valor_cuenta == null ? null : Number(x.valor_cuenta), ultimo_sync_at: x.ultimo_sync_at?.toISOString() ?? null })) ?? [],
  }));
}

export async function iniciarOAuth() {
  const c = await conexion();
  const state = randomBytes(32).toString('hex');
  await prisma.$transaction([
    prisma.broker_oauth_states.deleteMany({ where: { expira_at: { lt: new Date() } } }),
    prisma.broker_oauth_states.create({ data: { estado: state, conexion_id: c.id, expira_at: new Date(Date.now() + 10 * 60_000) } }),
  ]);
  return urlAutorizacion(state);
}

export async function completarOAuth(state: string, code: string) {
  const row = await prisma.broker_oauth_states.findUnique({ where: { estado: state } });
  if (!row || row.expira_at < new Date()) throw new HttpError(400, 'La autorización Schwab expiró; inicia el proceso otra vez.');
  await prisma.broker_oauth_states.delete({ where: { estado: state } });
  const token = await intercambiarCodigo(code);
  await guardarTokens(row.conexion_id, token, false);
}

async function posicionesCuenta(cuentaId: bigint, filas: unknown[]) {
  await prisma.posiciones.updateMany({ where: { broker_cuenta_id: cuentaId }, data: { activo: false } });
  for (const raw of filas) {
    const p = (raw ?? {}) as Record<string, unknown>;
    const instrument = (p.instrument ?? {}) as Record<string, unknown>;
    const ticker = texto(instrument.symbol)?.toUpperCase();
    if (!ticker) continue;
    const long = numero(p.longQuantity) ?? 0;
    const short = numero(p.shortQuantity) ?? 0;
    const cantidad = Math.abs(long - short);
    if (!(cantidad > 0)) continue;
    const claseRaw = String(instrument.assetType ?? '').toLowerCase();
    const clase = claseRaw.includes('equity') ? 'stock' : claseRaw.includes('mutual') ? 'fondo' : 'etf';
    const promedio = numero(p.averagePrice) ?? 0;
    await prisma.posiciones.upsert({
      where: { broker_cuenta_id_ticker: { broker_cuenta_id: cuentaId, ticker } },
      update: { nombre: texto(instrument.description), clase, cantidad, precio_compra_prom: promedio, moneda: texto(instrument.currency) ?? 'USD', fuente: 'schwab', activo: true },
      create: { broker_cuenta_id: cuentaId, fuente: 'schwab', ticker, nombre: texto(instrument.description), clase, cantidad, precio_compra_prom: promedio, moneda: texto(instrument.currency) ?? 'USD' },
    });
  }
}

function normalizarOperacion(cuentaId: bigint, raw: unknown): Prisma.broker_operacionesCreateInput | null {
  const t = (raw ?? {}) as Record<string, unknown>;
  const item = (t.transactionItem ?? {}) as Record<string, unknown>;
  const instrument = (item.instrument ?? {}) as Record<string, unknown>;
  const id = texto(t.transactionId) ?? texto(t.activityId) ?? createHash('sha256').update(JSON.stringify(raw)).digest('hex');
  const activity = String(t.activityType ?? '').toUpperCase();
  const tipo = activity.includes('TRADE') ? 'trade' : activity.includes('DIVIDEND') || activity.includes('INTEREST') ? 'dividendo' : activity.toLowerCase() || 'otro';
  return {
    broker_cuenta: { connect: { id: cuentaId } },
    external_id: id,
    tipo,
    lado: texto(item.instruction),
    ticker: texto(instrument.symbol)?.toUpperCase(),
    descripcion: texto(t.description),
    cantidad: numero(item.amount) ?? numero(item.quantity),
    precio: numero(item.price),
    monto: numero(t.netAmount) ?? numero(item.amount),
    comisiones: numero(t.fees),
    moneda: texto(instrument.currency) ?? 'USD',
    fecha: fechaApi(t.transactionDate ?? t.tradeDate ?? t.settlementDate),
    ejecutada_at: fechaHoraApi(t.transactionDate ?? t.tradeDate),
    datos_json: datosOperacion(t, item, instrument) as Prisma.InputJsonValue,
  };
}

async function operacionesCuenta(cuentaId: bigint, hash: string) {
  // Schwab limita el historial de transacciones a una ventana de 60 días.
  // Sincronizamos 59 para evitar errores por diferencias de reloj/zona horaria;
  // después, el sincronizador periódico conserva el historial hacia adelante.
  const desde = new Date(Date.now() - 59 * 86_400_000).toISOString();
  const hasta = new Date().toISOString();
  const q = new URLSearchParams({ startDate: desde, endDate: hasta });
  const data = await apiConRefresh<unknown>(`/trader/v1/accounts/${encodeURIComponent(hash)}/transactions?${q.toString()}`);
  const filas = Array.isArray(data) ? data : [];
  for (const raw of filas) {
    const op = normalizarOperacion(cuentaId, raw);
    if (!op) continue;
    const external = op.external_id;
    await prisma.broker_operaciones.upsert({
      where: { broker_cuenta_id_external_id: { broker_cuenta_id: cuentaId, external_id: external } },
      update: { tipo: op.tipo, lado: op.lado, ticker: op.ticker, descripcion: op.descripcion, cantidad: op.cantidad, precio: op.precio, monto: op.monto, comisiones: op.comisiones, moneda: op.moneda, fecha: op.fecha, ejecutada_at: op.ejecutada_at, datos_json: op.datos_json },
      create: op,
    });
  }
  return filas.length;
}

async function apiConRefresh<T>(path: string) {
  const c = await conexion();
  const token = await tokenValido(c);
  try {
    return await schwabGet<T>(path, token);
  } catch (e) {
    if (!(e instanceof HttpError) || e.status !== 401 || !c.refresh_token_enc) throw e;
    const refreshed = await renovarToken(descifrar(c.refresh_token_enc));
    await guardarTokens(c.id, refreshed);
    return schwabGet<T>(path, refreshed.access_token);
  }
}

export async function sincronizar() {
  if (sincronizacionEnCurso) throw new HttpError(409, 'Ya hay una sincronización Schwab en curso.');
  sincronizacionEnCurso = true;
  let c: Awaited<ReturnType<typeof conexion>> | null = null;
  try {
    c = await conexion();
    if (!c.access_token_enc && !c.refresh_token_enc) throw new HttpError(409, 'Primero conecta tu cuenta Schwab.');
    const numbers = await apiConRefresh<CuentaNumeros[]>('/trader/v1/accounts/accountNumbers');
    const hashes = new Map((numbers ?? []).filter((x) => x.accountNumber && x.hashValue).map((x) => [x.accountNumber!, x.hashValue!]));
    const accounts = await apiConRefresh<CuentaApi[]>('/trader/v1/accounts?fields=positions');
    const vistas = new Set<string>();
    let operaciones = 0;
    for (const row of accounts ?? []) {
      const sa = row.securitiesAccount ?? {};
      const accountNumber = texto(sa.accountNumber);
      const hash = accountNumber ? hashes.get(accountNumber) : null;
      if (!hash) continue;
      const b = await prisma.broker_cuentas.upsert({
        where: { conexion_id_hash_cuenta: { conexion_id: c.id, hash_cuenta: hash } },
        update: { cuenta_mascara: accountNumber ? `••••${accountNumber.slice(-4)}` : null, tipo: texto(sa.type), activo: true, ultimo_sync_at: new Date() },
        create: { conexion_id: c.id, hash_cuenta: hash, cuenta_mascara: accountNumber ? `••••${accountNumber.slice(-4)}` : null, tipo: texto(sa.type), ultimo_sync_at: new Date() },
      });
      vistas.add(hash);
      const posicionesApi = Array.isArray(sa.positions) ? sa.positions : [];
      await posicionesCuenta(b.id, posicionesApi);
      const balances = (sa.currentBalances ?? sa.initialBalances ?? {}) as Record<string, unknown>;
      await prisma.broker_cuentas.update({ where: { id: b.id }, data: { saldo_efectivo: numero(balances.cashBalance), valor_cuenta: numero(balances.accountValue ?? balances.liquidationValue), moneda: texto(balances.currency) ?? 'USD' } });
      operaciones += await operacionesCuenta(b.id, hash);
    }
    await prisma.broker_cuentas.updateMany({ where: { conexion_id: c.id, hash_cuenta: { notIn: [...vistas] } }, data: { activo: false } });
    await prisma.broker_conexiones.update({ where: { id: c.id }, data: { estado: 'conectada', ultimo_sync_at: new Date(), ultimo_error: null } });
    return { cuentas: vistas.size, operaciones };
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : 'Error desconocido al sincronizar Schwab';
    if (c) await prisma.broker_conexiones.update({ where: { id: c.id }, data: { estado: 'error', ultimo_error: mensaje.slice(0, 500) } }).catch(() => {});
    throw e;
  } finally {
    sincronizacionEnCurso = false;
  }
}

/** Sincronización periódica del servidor; no hace nada si Schwab no está configurado o conectado. */
export function iniciarScheduler() {
  if (!schwabDisponible()) return;
  const correr = async () => {
    const c = await prisma.broker_conexiones.findUnique({ where: { proveedor: PROVEEDOR }, select: { estado: true } });
    if (c?.estado !== 'conectada') return;
    await sincronizar();
  };
  setInterval(() => { correr().catch((e) => console.error('scheduler Schwab:', e instanceof Error ? e.message : 'error')); }, 30 * 60_000);
  console.log('🔗 Sincronizador Schwab preparado (cada 30 min cuando la cuenta está conectada).');
}

export async function operaciones() {
  const rows = await prisma.broker_operaciones.findMany({ orderBy: [{ fecha: 'desc' }, { id: 'desc' }], take: 100, include: { broker_cuenta: { select: { cuenta_mascara: true } } } });
  return rows.map((x) => ({ id: Number(x.id), tipo: x.tipo, lado: x.lado, ticker: x.ticker, descripcion: x.descripcion, cantidad: x.cantidad == null ? null : Number(x.cantidad), precio: x.precio == null ? null : Number(x.precio), monto: x.monto == null ? null : Number(x.monto), comisiones: x.comisiones == null ? null : Number(x.comisiones), moneda: x.moneda, fecha: x.fecha.toISOString().slice(0, 10), cuenta: x.broker_cuenta.cuenta_mascara }));
}

export async function desconectar() {
  const c = await prisma.broker_conexiones.findUnique({ where: { proveedor: PROVEEDOR } });
  if (!c) return;
  await prisma.$transaction(async (tx) => {
    await tx.posiciones.deleteMany({ where: { broker_cuenta: { conexion_id: c.id } } });
    await tx.broker_conexiones.delete({ where: { id: c.id } });
  });
}
