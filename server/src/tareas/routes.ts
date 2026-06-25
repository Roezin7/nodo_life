import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../auth/middleware.js';
import * as svc from './service.js';

export const tareasRouter = Router();
tareasRouter.use(requireAuth);

const id = z.coerce.number().int().positive();
const prioridad = z.enum(['baja', 'media', 'alta']);
const fechaOrNull = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

// --- Tablero (vista principal: Hoy / Próximos / Algún día / por Proyecto) ---
tareasRouter.get('/tablero', asyncHandler(async (_req, res) => {
  res.json(await svc.tablero());
}));

// --- Tareas ---
tareasRouter.get('/', asyncHandler(async (req, res) => {
  const q = z.object({
    vista: z.enum(['hoy', 'inbox', 'todas']).default('todas'),
    area_id: id.optional(),
    proyecto_id: id.optional(),
    incluir_hechas: z.coerce.boolean().optional(),
  }).parse(req.query);
  res.json(await svc.listarTareas(q.vista, { area_id: q.area_id, proyecto_id: q.proyecto_id, incluir_hechas: q.incluir_hechas }));
}));

tareasRouter.post('/', asyncHandler(async (req, res) => {
  const b = z.object({
    titulo: z.string().min(1),
    area_id: id.optional(),
    proyecto_id: id.nullable().optional(),
    prioridad: prioridad.optional(),
    fecha_vence: fechaOrNull.optional(),
    recurrencia: z.string().nullable().optional(),
    notas: z.string().optional(),
  }).parse(req.body);
  res.status(201).json(await svc.crearTarea(b));
}));

tareasRouter.patch('/:id', asyncHandler(async (req, res) => {
  const b = z.object({
    titulo: z.string().min(1).optional(),
    area_id: id.optional(),
    proyecto_id: id.nullable().optional(),
    prioridad: prioridad.optional(),
    fecha_vence: fechaOrNull.optional(),
    recurrencia: z.string().nullable().optional(),
    notas: z.string().optional(),
    estado: z.enum(['pendiente', 'hecha']).optional(),
  }).parse(req.body);
  res.json(await svc.editarTarea(BigInt(id.parse(req.params.id)), b));
}));

tareasRouter.delete('/:id', asyncHandler(async (req, res) => {
  await svc.borrarTarea(BigInt(id.parse(req.params.id)));
  res.status(204).end();
}));

// --- Proyectos ---
tareasRouter.get('/proyectos', asyncHandler(async (_req, res) => {
  res.json(await svc.listarProyectos());
}));

tareasRouter.get('/proyectos/:id', asyncHandler(async (req, res) => {
  res.json(await svc.detalleProyecto(BigInt(id.parse(req.params.id))));
}));

tareasRouter.post('/proyectos', asyncHandler(async (req, res) => {
  const b = z.object({
    nombre: z.string().min(1),
    area_id: id.optional(),
    descripcion: z.string().optional(),
    estado: z.enum(['activo', 'pausado', 'hecho']).optional(),
  }).parse(req.body);
  res.status(201).json(await svc.crearProyecto(b));
}));

tareasRouter.patch('/proyectos/:id', asyncHandler(async (req, res) => {
  const b = z.object({
    nombre: z.string().min(1).optional(),
    area_id: id.optional(),
    descripcion: z.string().optional(),
    estado: z.enum(['activo', 'pausado', 'hecho']).optional(),
    orden: z.coerce.number().int().optional(),
  }).parse(req.body);
  res.json(await svc.editarProyecto(BigInt(id.parse(req.params.id)), b));
}));

tareasRouter.delete('/proyectos/:id', asyncHandler(async (req, res) => {
  await svc.borrarProyecto(BigInt(id.parse(req.params.id)));
  res.status(204).end();
}));

tareasRouter.post('/proyectos/:id/avances', asyncHandler(async (req, res) => {
  const b = z.object({ nota: z.string().min(1), fecha: z.string().optional() }).parse(req.body);
  res.status(201).json(await svc.agregarAvance(BigInt(id.parse(req.params.id)), b.nota, b.fecha));
}));
