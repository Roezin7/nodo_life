import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../auth/middleware.js';
import { get as getConfig } from '../settings/service.js';
import * as svc from './service.js';

export const patrimonioRouter = Router();
patrimonioRouter.use(requireAuth);

const id = z.coerce.number().int().positive();

/** Patrimonio actual en vivo + si conviene un snapshot según la cadencia. */
patrimonioRouter.get('/', asyncHandler(async (_req, res) => {
  const cadencia = Number((await getConfig('snapshot_cadencia_dias')) ?? '7');
  const [vivo, sugerir] = await Promise.all([svc.patrimonioActual(), svc.sugerirSnapshot(cadencia)]);
  res.json({ ...vivo, sugerir_snapshot: sugerir, cadencia_dias: cadencia });
}));

/** Tendencia (serie de snapshots). */
patrimonioRouter.get('/snapshots', asyncHandler(async (_req, res) => {
  res.json(await svc.listarSnapshots());
}));

/** Congela un snapshot (hoy o fecha dada). */
patrimonioRouter.post('/snapshots', asyncHandler(async (req, res) => {
  const b = z.object({ fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(req.body);
  res.status(201).json(await svc.generarSnapshot(b.fecha));
}));

patrimonioRouter.delete('/snapshots/:id', asyncHandler(async (req, res) => {
  await svc.borrarSnapshot(BigInt(id.parse(req.params.id)));
  res.status(204).end();
}));

// --- Activos físicos no líquidos (casa, carro…) ---
const categoria = z.enum(['inmueble', 'vehiculo', 'otro']);
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

patrimonioRouter.get('/activos', asyncHandler(async (_req, res) => {
  res.json(await svc.listarActivosFisicos());
}));

patrimonioRouter.post('/activos', asyncHandler(async (req, res) => {
  const b = z.object({
    nombre: z.string().min(1),
    categoria: categoria.optional(),
    valor: z.number().nonnegative(),
    nota: z.string().optional(),
    fecha_valuacion: fecha.optional(),
  }).parse(req.body);
  res.status(201).json(await svc.crearActivoFisico(b));
}));

patrimonioRouter.patch('/activos/:id', asyncHandler(async (req, res) => {
  const b = z.object({
    nombre: z.string().min(1).optional(),
    categoria: categoria.optional(),
    valor: z.number().nonnegative().optional(),
    nota: z.string().nullable().optional(),
    fecha_valuacion: fecha.optional(),
    activo: z.boolean().optional(),
  }).parse(req.body);
  res.json(await svc.editarActivoFisico(BigInt(id.parse(req.params.id)), b));
}));

patrimonioRouter.delete('/activos/:id', asyncHandler(async (req, res) => {
  await svc.borrarActivoFisico(BigInt(id.parse(req.params.id)));
  res.status(204).end();
}));
