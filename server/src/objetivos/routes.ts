import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../auth/middleware.js';
import * as svc from './service.js';

export const objetivosRouter = Router();
objetivosRouter.use(requireAuth);

const id = z.coerce.number().int().positive();

objetivosRouter.get('/', asyncHandler(async (_req, res) => {
  res.json(await svc.listar());
}));

objetivosRouter.post('/', asyncHandler(async (req, res) => {
  const b = z.object({
    nombre: z.string().min(1),
    area_id: id.optional(),
    horizonte: z.enum(['trimestral', 'anual']).optional(),
    metrica: z.string().optional(),
    unidad: z.string().optional(),
    meta_valor: z.coerce.number(),
    valor_actual: z.coerce.number().optional(),
    fecha_inicio: z.string().optional(),
    fecha_fin: z.string().optional(),
  }).parse(req.body);
  res.status(201).json(await svc.crearObjetivo(b));
}));

objetivosRouter.patch('/:id', asyncHandler(async (req, res) => {
  const b = z.object({
    nombre: z.string().min(1).optional(),
    area_id: id.optional(),
    horizonte: z.enum(['trimestral', 'anual']).optional(),
    metrica: z.string().optional(),
    unidad: z.string().optional(),
    meta_valor: z.coerce.number().optional(),
    valor_actual: z.coerce.number().optional(),
    estado: z.enum(['activo', 'logrado', 'vencido']).optional(),
    fecha_inicio: z.string().optional(),
    fecha_fin: z.string().optional(),
  }).parse(req.body);
  res.json(await svc.editarObjetivo(BigInt(id.parse(req.params.id)), b));
}));

objetivosRouter.delete('/:id', asyncHandler(async (req, res) => {
  await svc.borrarObjetivo(BigInt(id.parse(req.params.id)));
  res.status(204).end();
}));

objetivosRouter.post('/:id/vinculos', asyncHandler(async (req, res) => {
  const b = z.object({
    fuente: z.enum(['manual', 'habito', 'proyecto', 'kpi_financiero']),
    ref_id: id.nullable().optional(),
  }).parse(req.body);
  res.status(201).json(await svc.agregarVinculo(BigInt(id.parse(req.params.id)), b.fuente, b.ref_id));
}));

objetivosRouter.delete('/vinculos/:id', asyncHandler(async (req, res) => {
  await svc.borrarVinculo(BigInt(id.parse(req.params.id)));
  res.status(204).end();
}));
