import jwt from 'jsonwebtoken';
import { env } from '../env.js';

export interface JwtPayload {
  sub: string; // usuario_id (string porque viene de BigInt)
  nombre: string;
  ver: number; // versión de sesión; cambia al actualizar el PIN
}

const EXPIRA_EN = '7d';

export function firmarToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: EXPIRA_EN });
}

export function verificarToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
