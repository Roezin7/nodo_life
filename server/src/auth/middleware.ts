import type { RequestHandler } from 'express';
import { verificarToken, type JwtPayload } from './jwt.js';
import { HttpError } from '../middleware/error.js';
import { prisma } from '../db.js';

const COOKIE = 'nodo_vida_session';

function cookieValue(raw: string | undefined, name: string): string | null {
  const item = raw?.split(';').map((x) => x.trim()).find((x) => x.startsWith(`${name}=`));
  if (!item) return null;
  try {
    return decodeURIComponent(item.slice(name.length + 1));
  } catch {
    return null;
  }
}

// Extiende Request con el usuario autenticado. Usuario único: sin negocio ni rol.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: JwtPayload & { usuarioId: bigint };
    }
  }
}

/** Exige un JWT válido; adjunta req.auth con el id ya convertido a BigInt. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : cookieValue(req.headers.cookie, COOKIE);
  if (!token) {
    throw new HttpError(401, 'Falta el token de autenticación');
  }
  try {
    const payload = verificarToken(token);
    if (!Number.isInteger(payload.ver)) throw new Error('Sesión antigua');
    void prisma.usuario.findUnique({ where: { id: BigInt(payload.sub) }, select: { sesion_version: true } })
      .then((usuario) => {
        if (!usuario || usuario.sesion_version !== payload.ver) return next(new HttpError(401, 'Sesión revocada; inicia sesión de nuevo'));
        req.auth = { ...payload, usuarioId: BigInt(payload.sub) };
        next();
      })
      .catch(() => next(new HttpError(401, 'No se pudo validar la sesión')));
  } catch {
    next(new HttpError(401, 'Token inválido o expirado'));
  }
};
