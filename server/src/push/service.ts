import webpush from 'web-push';
import { prisma } from '../db.js';
import { env } from '../env.js';

// ---------------------------------------------------------------------------
//  Web Push: suscripciones por dispositivo + envío de notificaciones.
//  Si faltan las claves VAPID, el módulo queda inerte (la app sigue igual).
// ---------------------------------------------------------------------------

let configurado = false;
export function pushDisponible(): boolean {
  if (configurado) return true;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  configurado = true;
  return true;
}

export function clavePublica(): string {
  return env.VAPID_PUBLIC_KEY;
}

export interface SuscripcionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function guardarSuscripcion(s: SuscripcionInput) {
  await prisma.push_suscripciones.upsert({
    where: { endpoint: s.endpoint },
    update: { p256dh: s.keys.p256dh, auth: s.keys.auth },
    create: { endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth },
  });
  return { ok: true };
}

export async function borrarSuscripcion(endpoint: string) {
  await prisma.push_suscripciones.deleteMany({ where: { endpoint } });
  return { ok: true };
}

export interface NotifPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Envía una notificación a todos los dispositivos suscritos.
 * Limpia las suscripciones caducadas (404/410 = el navegador la dio de baja).
 * Devuelve cuántos envíos tuvieron éxito.
 */
export async function enviarATodas(payload: NotifPayload): Promise<number> {
  if (!pushDisponible()) return 0;
  const subs = await prisma.push_suscripciones.findMany();
  if (subs.length === 0) return 0;
  const data = JSON.stringify(payload);
  let ok = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, data);
        ok++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.push_suscripciones.delete({ where: { endpoint: s.endpoint } }).catch(() => {});
        }
      }
    }),
  );
  return ok;
}
