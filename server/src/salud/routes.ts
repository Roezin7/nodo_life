import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../auth/middleware.js';
import * as svc from './service.js';

export const saludRouter = Router();
saludRouter.use(requireAuth);

const id = z.coerce.number().int().positive();
const hora = z.string().regex(/^\d{2}:\d{2}$/);

// --- Peso ---
saludRouter.get('/peso', asyncHandler(async (_req, res) => {
  res.json(await svc.tendenciaPeso());
}));

saludRouter.post('/peso', asyncHandler(async (req, res) => {
  const b = z.object({
    fecha: z.string().optional(),
    hora: hora.optional(),
    peso: z.coerce.number().positive().max(500),
  }).parse(req.body);
  res.status(201).json(await svc.registrarPeso(b));
}));

saludRouter.delete('/peso/:id', asyncHandler(async (req, res) => {
  await svc.borrarPeso(BigInt(id.parse(req.params.id)));
  res.status(204).end();
}));

// --- Etapa ---
saludRouter.get('/etapa', asyncHandler(async (_req, res) => {
  res.json(await svc.getEtapa());
}));

saludRouter.post('/etapa', asyncHandler(async (req, res) => {
  const b = z.object({
    tipo: z.enum(['deficit', 'volumen', 'mantenimiento']).nullable().optional(),
    desde: z.string().optional(),
    nota: z.string().optional(),
  }).parse(req.body);
  res.status(201).json(await svc.setEtapa(b));
}));

// --- Tipos de entrenamiento ---
saludRouter.get('/tipos', asyncHandler(async (_req, res) => {
  res.json(await svc.tiposEntrenamiento());
}));

saludRouter.post('/tipos', asyncHandler(async (req, res) => {
  const { nombre } = z.object({ nombre: z.string().min(1) }).parse(req.body);
  res.status(201).json(await svc.crearTipoEntrenamiento(nombre));
}));

// --- Entrenamientos ---
saludRouter.get('/entrenamientos', asyncHandler(async (req, res) => {
  const tipo_id = id.optional().parse(req.query.tipo_id);
  res.json(await svc.listarEntrenamientos(tipo_id));
}));

saludRouter.post('/entrenamientos', asyncHandler(async (req, res) => {
  const b = z.object({
    fecha: z.string().optional(),
    tipo_id: id,
    duracion_min: z.coerce.number().int().nonnegative().optional(),
    notas: z.string().optional(),
    metricas: z.record(z.string(), z.unknown()).optional(),
    series: z.array(z.object({
      ejercicio: z.string().min(1),
      series: z.coerce.number().int().nonnegative().optional(),
      reps: z.coerce.number().int().nonnegative().optional(),
      peso: z.coerce.number().nonnegative().optional(),
    })).optional(),
  }).parse(req.body);
  res.status(201).json(await svc.crearEntrenamiento(b));
}));

saludRouter.delete('/entrenamientos/:id', asyncHandler(async (req, res) => {
  await svc.borrarEntrenamiento(BigInt(id.parse(req.params.id)));
  res.status(204).end();
}));

saludRouter.get('/progresion/:tipoId', asyncHandler(async (req, res) => {
  res.json(await svc.progresion(id.parse(req.params.tipoId)));
}));
