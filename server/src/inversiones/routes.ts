import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../auth/middleware.js';
import * as svc from './service.js';
import { verificarTicker } from './precios.js';

export const inversionesRouter = Router();
inversionesRouter.use(requireAuth);

const id = z.coerce.number().int().positive();
const clase = z.enum(['stock', 'etf', 'fondo', 'crypto']);

/** Portafolio valuado a mercado (precio diferido) + P&L + FX. */
inversionesRouter.get('/', asyncHandler(async (_req, res) => {
  res.json(await svc.portafolio());
}));

/** Verifica que un ticker exista/cotice antes de guardar la posición. */
inversionesRouter.get('/verificar', asyncHandler(async (req, res) => {
  const ticker = z.string().min(1).max(15).parse(req.query.ticker);
  res.json(await verificarTicker(ticker));
}));

// Acepta `costo_total` (lo que pide el usuario) o `precio_compra_prom` directo.
// Si llega costo_total, el promedio = costo_total / cantidad.
const posicionBase = z.object({
  ticker: z.string().min(1).max(15),
  nombre: z.string().optional(),
  clase: clase.optional(),
  cantidad: z.coerce.number().positive(),
  precio_compra_prom: z.coerce.number().nonnegative().optional(),
  costo_total: z.coerce.number().nonnegative().optional(),
  moneda: z.string().optional(),
  fecha_inicio: z.string().optional(),
}).refine((b) => b.precio_compra_prom != null || b.costo_total != null, {
  message: 'Falta el costo (total o promedio)',
});

inversionesRouter.post('/posiciones', asyncHandler(async (req, res) => {
  const b = posicionBase.parse(req.body);
  const precio_compra_prom = b.precio_compra_prom ?? (b.costo_total! / b.cantidad);
  res.status(201).json(await svc.crearPosicion({ ...b, precio_compra_prom }));
}));

inversionesRouter.patch('/posiciones/:id', asyncHandler(async (req, res) => {
  const b = z.object({
    ticker: z.string().min(1).max(15).optional(),
    nombre: z.string().optional(),
    clase: clase.optional(),
    cantidad: z.coerce.number().positive().optional(),
    precio_compra_prom: z.coerce.number().nonnegative().optional(),
    moneda: z.string().optional(),
    fecha_inicio: z.string().optional(),
    activo: z.boolean().optional(),
  }).parse(req.body);
  res.json(await svc.editarPosicion(BigInt(id.parse(req.params.id)), b));
}));

inversionesRouter.delete('/posiciones/:id', asyncHandler(async (req, res) => {
  await svc.borrarPosicion(BigInt(id.parse(req.params.id)));
  res.status(204).end();
}));
