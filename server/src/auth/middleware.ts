import type { RequestHandler } from 'express';
import { verificarToken, type JwtPayload } from './jwt.js';
import { HttpError } from '../middleware/error.js';

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
  if (!header?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Falta el token de autenticación');
  }
  try {
    const payload = verificarToken(header.slice(7));
    req.auth = { ...payload, usuarioId: BigInt(payload.sub) };
    next();
  } catch {
    throw new HttpError(401, 'Token inválido o expirado');
  }
};
