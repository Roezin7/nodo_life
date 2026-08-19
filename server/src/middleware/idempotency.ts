import type { RequestHandler } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { HttpError } from './error.js';

// El cliente conserva esta clave cuando una mutación falla después de haber
// llegado al servidor. Así el reintento devuelve la respuesta original.
const CLAVE = /^[A-Za-z0-9._:-]{16,128}$/;
const enVuelo = new Map<string, Promise<void>>();

const limpieza = setInterval(() => {
  void prisma.idempotency_keys.deleteMany({ where: { creado_at: { lt: new Date(Date.now() - 7 * 86_400_000) } } }).catch(() => {});
}, 24 * 60 * 60_000);
limpieza.unref();

async function respuestaGuardada(clave: string) {
  return prisma.idempotency_keys.findUnique({ where: { clave } });
}

function responder(res: Parameters<RequestHandler>[1], fila: { status: number; respuesta: Prisma.JsonValue }) {
  return res.status(fila.status).json(fila.respuesta);
}

/** Idempotencia para POST/PATCH/PUT; DELETE ya es naturalmente repetible. */
export const idempotencyMiddleware: RequestHandler = (req, res, next) => {
  if (!['POST', 'PATCH', 'PUT'].includes(req.method)) return next();

  const clave = req.get('Idempotency-Key');
  if (!clave) return next();
  if (!CLAVE.test(clave)) return next(new HttpError(400, 'Idempotency-Key inválida'));
  // Una misma clave puede reutilizarse legítimamente en endpoints distintos;
  // el alcance debe ser la mutación concreta, no toda la API.
  const claveAlcance = `${req.method}:${req.originalUrl}:${clave}`;

  void (async () => {
    const existente = await respuestaGuardada(claveAlcance);
    if (existente) return responder(res, existente);

    const pendiente = enVuelo.get(claveAlcance);
    if (pendiente) {
      await pendiente.catch(() => {});
      const reintento = await respuestaGuardada(claveAlcance);
      if (reintento) return responder(res, reintento);
      return next(new HttpError(409, 'La mutación anterior no pudo confirmarse; intenta de nuevo.'));
    }

    let liberar!: () => void;
    const lock = new Promise<void>((resolve) => { liberar = resolve; });
    enVuelo.set(claveAlcance, lock);

    let capturada: unknown = null;
    const jsonOriginal = res.json.bind(res);
    res.json = ((body: unknown) => {
      capturada = body;
      return jsonOriginal(body);
    }) as typeof res.json;

    res.once('finish', () => {
      const guardar = async () => {
        try {
          if (res.statusCode < 500) {
            const respuesta = JSON.parse(JSON.stringify(capturada ?? null)) as Prisma.InputJsonValue;
            await prisma.idempotency_keys.create({ data: { clave: claveAlcance, status: res.statusCode, respuesta } });
          }
        } finally {
          enVuelo.delete(claveAlcance);
          liberar();
        }
      };
      void guardar();
    });

    next();
  })().catch(next);
};
