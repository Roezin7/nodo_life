import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../auth/middleware.js';
import * as svc from './service.js';

export const pushRouter = Router();
pushRouter.use(requireAuth);

/** Clave pública VAPID + si el servidor tiene push configurado. */
pushRouter.get('/clave-publica', asyncHandler(async (_req, res) => {
  res.json({ disponible: svc.pushDisponible(), clave: svc.clavePublica() });
}));

const suscripcion = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

pushRouter.post('/suscribir', asyncHandler(async (req, res) => {
  const b = suscripcion.parse(req.body);
  res.status(201).json(await svc.guardarSuscripcion(b));
}));

pushRouter.post('/baja', asyncHandler(async (req, res) => {
  const b = z.object({ endpoint: z.string().url() }).parse(req.body);
  res.json(await svc.borrarSuscripcion(b.endpoint));
}));

/** Envía una notificación de prueba a este dispositivo (y demás suscritos). */
pushRouter.post('/probar', asyncHandler(async (_req, res) => {
  const enviados = await svc.enviarATodas({
    title: 'Nodo Vida',
    body: '🔔 Listo: los recordatorios funcionan en este dispositivo.',
    url: '/',
    tag: 'prueba',
  });
  res.json({ enviados });
}));
