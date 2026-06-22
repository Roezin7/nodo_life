import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../auth/middleware.js';
import * as svc from './service.js';

export const revisionesRouter = Router();
revisionesRouter.use(requireAuth);

const id = z.coerce.number().int().positive();

revisionesRouter.get('/', asyncHandler(async (req, res) => {
  const tipo = z.enum(['diaria', 'semanal']).optional().parse(req.query.tipo);
  res.json(await svc.listar(tipo));
}));

revisionesRouter.post('/', asyncHandler(async (req, res) => {
  const b = z.object({
    tipo: z.enum(['diaria', 'semanal']),
    fecha: z.string().optional(),
    notas: z.string().optional(),
    ia_resumen: z.unknown().optional(),
  }).parse(req.body);
  res.status(201).json(await svc.crear(b));
}));

revisionesRouter.delete('/:id', asyncHandler(async (req, res) => {
  await svc.borrar(BigInt(id.parse(req.params.id)));
  res.status(204).end();
}));
