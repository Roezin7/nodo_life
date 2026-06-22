import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { firmarToken } from './jwt.js';
import { requireAuth } from './middleware.js';

export const authRouter = Router();

/** El usuario único (para mostrar el nombre en el login). No expone pin_hash. */
async function elUsuario() {
  return prisma.usuario.findFirst({ orderBy: { id: 'asc' } });
}

/** GET /auth/usuario -> { nombre } | null (saludo del login). */
authRouter.get(
  '/usuario',
  asyncHandler(async (_req, res) => {
    const u = await elUsuario();
    res.json(u ? { nombre: u.nombre } : null);
  }),
);

const loginSchema = z.object({ pin: z.string().min(3).max(12) });

/** POST /auth/login { pin } -> { token, usuario } */
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { pin } = loginSchema.parse(req.body);
    const usuario = await elUsuario();
    if (!usuario || !(await bcrypt.compare(pin, usuario.pin_hash))) {
      throw new HttpError(401, 'PIN incorrecto');
    }
    const token = firmarToken({ sub: usuario.id.toString(), nombre: usuario.nombre });
    res.json({ token, usuario: { id: Number(usuario.id), nombre: usuario.nombre } });
  }),
);

/** GET /auth/me -> datos del usuario autenticado */
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.auth!.usuarioId },
      select: { id: true, nombre: true },
    });
    if (!usuario) throw new HttpError(404, 'Usuario no encontrado');
    res.json({ id: Number(usuario.id), nombre: usuario.nombre });
  }),
);

const cambiarPinSchema = z.object({
  pin_actual: z.string().min(3).max(12),
  pin_nuevo: z.string().min(4).max(12),
});

/** POST /auth/cambiar-pin { pin_actual, pin_nuevo } */
authRouter.post(
  '/cambiar-pin',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { pin_actual, pin_nuevo } = cambiarPinSchema.parse(req.body);
    const usuario = await prisma.usuario.findUnique({ where: { id: req.auth!.usuarioId } });
    if (!usuario || !(await bcrypt.compare(pin_actual, usuario.pin_hash))) {
      throw new HttpError(401, 'PIN actual incorrecto');
    }
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { pin_hash: await bcrypt.hash(pin_nuevo, 10) },
    });
    res.json({ ok: true });
  }),
);

/** PATCH /auth/nombre { nombre } — cambia el nombre del usuario. */
authRouter.patch(
  '/nombre',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { nombre } = z.object({ nombre: z.string().min(1).max(60) }).parse(req.body);
    await prisma.usuario.update({ where: { id: req.auth!.usuarioId }, data: { nombre } });
    res.json({ ok: true });
  }),
);
