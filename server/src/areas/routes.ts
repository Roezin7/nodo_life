import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../auth/middleware.js';
import * as svc from './service.js';

export const areasRouter = Router();
areasRouter.use(requireAuth);

const id = z.coerce.number().int().positive();

areasRouter.get('/', asyncHandler(async (req, res) => {
  const todas = req.query.todas === '1';
  res.json(await svc.listar(todas));
}));

areasRouter.post('/', asyncHandler(async (req, res) => {
  const b = z.object({
    nombre: z.string().min(1),
    color: z.string().optional(),
    icono: z.string().optional(),
  }).parse(req.body);
  res.status(201).json(await svc.crear(b));
}));

areasRouter.patch('/:id', asyncHandler(async (req, res) => {
  const b = z.object({
    nombre: z.string().min(1).optional(),
    color: z.string().optional(),
    icono: z.string().optional(),
    orden: z.coerce.number().int().optional(),
    activo: z.boolean().optional(),
  }).parse(req.body);
  res.json(await svc.editar(BigInt(id.parse(req.params.id)), b));
}));
