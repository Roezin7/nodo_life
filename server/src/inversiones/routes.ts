import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../auth/middleware.js';
import * as svc from './service.js';

export const inversionesRouter = Router();
inversionesRouter.use(requireAuth);

const id = z.coerce.number().int().positive();
const clase = z.enum(['stock', 'etf', 'crypto']);

/** Portafolio valuado a mercado (precio diferido) + P&L + FX. */
inversionesRouter.get('/', asyncHandler(async (_req, res) => {
  res.json(await svc.portafolio());
}));

inversionesRouter.post('/posiciones', asyncHandler(async (req, res) => {
  const b = z.object({
    ticker: z.string().min(1).max(15),
    nombre: z.string().optional(),
    clase: clase.optional(),
    cantidad: z.coerce.number().positive(),
    precio_compra_prom: z.coerce.number().nonnegative(),
    moneda: z.string().optional(),
    fecha_inicio: z.string().optional(),
  }).parse(req.body);
  res.status(201).json(await svc.crearPosicion(b));
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
