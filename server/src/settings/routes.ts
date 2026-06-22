import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../auth/middleware.js';
import * as svc from './service.js';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get('/', asyncHandler(async (_req, res) => {
  res.json(await svc.getTodo());
}));

settingsRouter.put('/', asyncHandler(async (req, res) => {
  const body = z.record(z.string(), z.string()).parse(req.body);
  for (const [clave, valor] of Object.entries(body)) {
    await svc.set(clave, valor);
  }
  res.json(await svc.getTodo());
}));
