import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware.js';
import { asyncHandler, HttpError } from '../middleware/error.js';
import * as svc from './service.js';

export const schwabRouter = Router();

schwabRouter.get('/oauth/callback', asyncHandler(async (req, res) => {
  const { code, state, error } = z.object({ code: z.string().optional(), state: z.string().optional(), error: z.string().optional() }).parse(req.query);
  if (error) throw new HttpError(400, `Schwab canceló la autorización: ${error}`);
  if (!code || !state) throw new HttpError(400, 'Callback de Schwab incompleto.');
  await svc.completarOAuth(state, code);
  res.redirect('/configuracion?schwab=conectada');
}));

schwabRouter.use(requireAuth);

schwabRouter.get('/estado', asyncHandler(async (_req, res) => {
  res.json(await svc.estado());
}));

schwabRouter.get('/conectar', asyncHandler(async (_req, res) => {
  res.redirect(await svc.iniciarOAuth());
}));

schwabRouter.post('/sincronizar', asyncHandler(async (_req, res) => {
  res.json(await svc.sincronizar());
}));

schwabRouter.get('/operaciones', asyncHandler(async (_req, res) => {
  res.json(await svc.operaciones());
}));

schwabRouter.delete('/conexion', asyncHandler(async (_req, res) => {
  await svc.desconectar();
  res.status(204).end();
}));
