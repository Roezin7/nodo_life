import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../auth/middleware.js';
import * as svc from './service.js';

export const habitosRouter = Router();
habitosRouter.use(requireAuth);

const id = z.coerce.number().int().positive();
const tipo = z.enum(['binario', 'numerico', 'tiempo']);
const frecuencia = z.enum(['diaria', 'semanal_x_veces']);
const horaOrNull = z.string().regex(/^\d{2}:\d{2}$/).nullable();

/** Tracker semanal (vista principal de hábitos). */
habitosRouter.get('/', asyncHandler(async (req, res) => {
  const semana = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().parse(req.query.semana);
  res.json(await svc.tracker(semana));
}));

habitosRouter.post('/', asyncHandler(async (req, res) => {
  const b = z.object({
    nombre: z.string().min(1),
    area_id: id,
    tipo: tipo.optional(),
    frecuencia: frecuencia.optional(),
    meta: z.coerce.number().positive().nullable().optional(),
    recordatorio_hora: horaOrNull.optional(),
  }).parse(req.body);
  res.status(201).json(await svc.crearHabito(b));
}));

habitosRouter.patch('/:id', asyncHandler(async (req, res) => {
  const b = z.object({
    nombre: z.string().min(1).optional(),
    area_id: id.optional(),
    tipo: tipo.optional(),
    frecuencia: frecuencia.optional(),
    meta: z.coerce.number().positive().nullable().optional(),
    recordatorio_hora: horaOrNull.optional(),
    activo: z.boolean().optional(),
    orden: z.coerce.number().int().optional(),
  }).parse(req.body);
  res.json(await svc.editarHabito(BigInt(id.parse(req.params.id)), b));
}));

habitosRouter.delete('/:id', asyncHandler(async (req, res) => {
  await svc.borrarHabito(BigInt(id.parse(req.params.id)));
  res.status(204).end();
}));

/** Marcar/registrar el hábito en una fecha. */
habitosRouter.post('/:id/registro', asyncHandler(async (req, res) => {
  const b = z.object({
    fecha: z.string().optional(),
    valor: z.coerce.number().optional(),
    completado: z.boolean().optional(),
  }).parse(req.body);
  res.json(await svc.registrar(BigInt(id.parse(req.params.id)), b));
}));

/** Destachar (borrar registro de una fecha). */
habitosRouter.delete('/:id/registro', asyncHandler(async (req, res) => {
  const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(req.query.fecha);
  res.json(await svc.desmarcar(BigInt(id.parse(req.params.id)), fecha));
}));
