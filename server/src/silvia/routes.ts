import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../auth/middleware.js';
import { silviaDisponible } from './agent.js';
import { borradorCaptura, capturaDisponible } from './draft.js';
import * as svc from './service.js';

export const silviaRouter = Router();
silviaRouter.use(requireAuth);

const id = z.coerce.number().int().positive();

/** Indica si la IA está configurada (hay API key) — para mostrar/ocultar la burbuja. */
silviaRouter.get('/estado', asyncHandler(async (_req, res) => {
  res.json({ disponible: silviaDisponible(), captura: capturaDisponible() });
}));

silviaRouter.get('/historial', asyncHandler(async (_req, res) => {
  res.json(await svc.historial());
}));

/** Borra la conversación (al cerrar sesión). Conserva la memoria/aprendizajes. */
silviaRouter.delete('/historial', asyncHandler(async (_req, res) => {
  await svc.borrarHistorial();
  res.status(204).end();
}));

silviaRouter.post('/chat', asyncHandler(async (req, res) => {
  const { mensaje } = z.object({ mensaje: z.string().min(1).max(2000) }).parse(req.body);
  res.json(await svc.chat(mensaje));
}));

/** Captura asistida: propone un borrador editable (no escribe). */
silviaRouter.post('/captura', asyncHandler(async (req, res) => {
  const { texto } = z.object({ texto: z.string().min(1).max(1000) }).parse(req.body);
  res.json(await borradorCaptura(texto));
}));

silviaRouter.get('/memoria', asyncHandler(async (_req, res) => {
  res.json(await svc.listarMemoria());
}));

silviaRouter.post('/eventos', asyncHandler(async (req, res) => {
  const b = z.object({ contenido: z.string().min(1).max(500), fecha: z.string().optional() }).parse(req.body);
  res.status(201).json(await svc.registrarEvento(b.contenido, b.fecha));
}));

silviaRouter.delete('/memoria/:id', asyncHandler(async (req, res) => {
  await svc.borrarMemoria(BigInt(id.parse(req.params.id)));
  res.status(204).end();
}));
