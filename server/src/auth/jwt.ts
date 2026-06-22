import jwt from 'jsonwebtoken';
import { env } from '../env.js';

export interface JwtPayload {
  sub: string; // usuario_id (string porque viene de BigInt)
  nombre: string;
}

const EXPIRA_EN = '30d'; // sesión larga: es un dispositivo personal dedicado

export function firmarToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: EXPIRA_EN });
}

export function verificarToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
