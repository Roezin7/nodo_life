import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../auth/middleware.js';
import * as svc from './service.js';

export const finanzasRouter = Router();
finanzasRouter.use(requireAuth);

const id = z.coerce.number().int().positive();
const mesRe = z.string().regex(/^\d{4}-\d{2}$/);
const periodo = z.enum(['mes', 'semana']).optional();
// ref: YYYY-MM (mes) o YYYY-MM-DD (semana).
const ref = z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/).optional();

// --- Referencias / dashboard ---
finanzasRouter.get('/referencias', asyncHandler(async (_req, res) => {
  res.json(await svc.referencias());
}));

finanzasRouter.get('/dashboard', asyncHandler(async (req, res) => {
  const q = z.object({ periodo, ref, mes: mesRe.optional() }).parse(req.query);
  res.json(await svc.dashboard({ periodo: q.periodo, ref: q.ref ?? q.mes }));
}));

finanzasRouter.get('/saldos', asyncHandler(async (_req, res) => {
  res.json(await svc.saldosActuales());
}));

// --- Movimientos ---
finanzasRouter.get('/movimientos', asyncHandler(async (req, res) => {
  const q = z.object({
    periodo,
    ref,
    mes: mesRe.optional(),
    area_id: id.optional(),
    categoria_id: id.optional(),
  }).parse(req.query);
  res.json(await svc.listarMovimientos({ periodo: q.periodo, ref: q.ref ?? q.mes, area_id: q.area_id, categoria_id: q.categoria_id }));
}));

finanzasRouter.post('/movimientos', asyncHandler(async (req, res) => {
  const b = z.object({
    tipo: z.enum(['ingreso', 'gasto', 'transferencia']),
    monto: z.coerce.number().positive(),
    fecha: z.string().optional(),
    cuenta_origen_id: id.nullable().optional(),
    cuenta_destino_id: id.nullable().optional(),
    categoria_id: id.nullable().optional(),
    area_id: id.nullable().optional(),
    descripcion: z.string().optional(),
  }).parse(req.body);
  res.status(201).json(await svc.crearMovimiento(b));
}));

finanzasRouter.delete('/movimientos/:id', asyncHandler(async (req, res) => {
  await svc.borrarMovimiento(BigInt(id.parse(req.params.id)));
  res.status(204).end();
}));

// --- Tipos de cuenta / cuentas ---
finanzasRouter.post('/tipos-cuenta', asyncHandler(async (req, res) => {
  const { nombre } = z.object({ nombre: z.string().min(1) }).parse(req.body);
  res.status(201).json(await svc.crearTipoCuenta(nombre));
}));

finanzasRouter.post('/cuentas', asyncHandler(async (req, res) => {
  const b = z.object({
    nombre: z.string().min(1),
    tipo_id: id,
    moneda: z.string().optional(),
    saldo_inicial: z.coerce.number().optional(),
    es_central: z.boolean().optional(),
  }).parse(req.body);
  res.status(201).json(await svc.crearCuenta(b));
}));

finanzasRouter.patch('/cuentas/:id', asyncHandler(async (req, res) => {
  const b = z.object({
    nombre: z.string().min(1).optional(),
    tipo_id: id.optional(),
    moneda: z.string().optional(),
    saldo_inicial: z.coerce.number().optional(),
    es_central: z.boolean().optional(),
    activo: z.boolean().optional(),
  }).parse(req.body);
  res.json(await svc.editarCuenta(BigInt(id.parse(req.params.id)), b));
}));

// --- Categorías ---
finanzasRouter.post('/categorias', asyncHandler(async (req, res) => {
  const b = z.object({
    nombre: z.string().min(1),
    clase: z.enum(['ingreso', 'gasto']),
    area_id: id.nullable().optional(),
  }).parse(req.body);
  res.status(201).json(await svc.crearCategoria(b));
}));

finanzasRouter.patch('/categorias/:id', asyncHandler(async (req, res) => {
  const b = z.object({
    nombre: z.string().min(1).optional(),
    area_id: id.nullable().optional(),
    activo: z.boolean().optional(),
  }).parse(req.body);
  res.json(await svc.editarCategoria(BigInt(id.parse(req.params.id)), b));
}));

// --- Presupuestos ---
finanzasRouter.get('/presupuestos', asyncHandler(async (_req, res) => {
  res.json(await svc.listarPresupuestos());
}));

finanzasRouter.post('/presupuestos', asyncHandler(async (req, res) => {
  const b = z.object({
    categoria_id: id.nullable().optional(),
    area_id: id.nullable().optional(),
    monto_limite: z.coerce.number().positive(),
  }).parse(req.body);
  res.status(201).json(await svc.crearPresupuesto(b));
}));

finanzasRouter.delete('/presupuestos/:id', asyncHandler(async (req, res) => {
  await svc.borrarPresupuesto(BigInt(id.parse(req.params.id)));
  res.status(204).end();
}));

// --- Por cobrar ---
finanzasRouter.get('/por-cobrar', asyncHandler(async (_req, res) => {
  res.json(await svc.listarPorCobrar());
}));

finanzasRouter.post('/por-cobrar', asyncHandler(async (req, res) => {
  const b = z.object({
    descripcion: z.string().min(1),
    deudor: z.string().optional(),
    monto: z.coerce.number().positive(),
    fecha: z.string().optional(),
  }).parse(req.body);
  res.status(201).json(await svc.crearPorCobrar(b));
}));

finanzasRouter.patch('/por-cobrar/:id', asyncHandler(async (req, res) => {
  const b = z.object({ estado: z.enum(['pendiente', 'cobrado']).optional(), monto: z.coerce.number().positive().optional() }).parse(req.body);
  res.json(await svc.actualizarPorCobrar(BigInt(id.parse(req.params.id)), b));
}));

// --- Deudas ---
finanzasRouter.get('/deudas', asyncHandler(async (_req, res) => {
  res.json(await svc.listarDeudas());
}));

finanzasRouter.post('/deudas', asyncHandler(async (req, res) => {
  const b = z.object({
    descripcion: z.string().min(1),
    acreedor: z.string().optional(),
    monto: z.coerce.number().positive(),
    fecha: z.string().optional(),
  }).parse(req.body);
  res.status(201).json(await svc.crearDeuda(b));
}));

finanzasRouter.patch('/deudas/:id', asyncHandler(async (req, res) => {
  const b = z.object({ estado: z.enum(['pendiente', 'pagado']).optional(), monto: z.coerce.number().positive().optional() }).parse(req.body);
  res.json(await svc.actualizarDeuda(BigInt(id.parse(req.params.id)), b));
}));
