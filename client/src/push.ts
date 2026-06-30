// Activación de recordatorios (Web Push) en este dispositivo.
// Flujo: pide permiso → suscribe vía PushManager con la clave VAPID del server → guarda la suscripción.

import { api } from './api';

export function pushSoportado(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function permisoActual(): NotificationPermission {
  return pushSoportado() ? Notification.permission : 'denied';
}

export async function estaSuscrito(): Promise<boolean> {
  if (!pushSoportado()) return false;
  const reg = await navigator.serviceWorker.ready;
  return !!(await reg.pushManager.getSubscription());
}

function base64ToUint8(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** Activa los recordatorios en este dispositivo. Lanza Error con mensaje legible si falla. */
export async function activarPush(): Promise<void> {
  if (!pushSoportado()) throw new Error('Este dispositivo o navegador no soporta notificaciones push.');

  const { disponible, clave } = await api<{ disponible: boolean; clave: string }>('/push/clave-publica');
  if (!disponible || !clave) throw new Error('El servidor aún no tiene los recordatorios configurados (faltan claves VAPID).');

  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') throw new Error('Necesito permiso de notificaciones para enviarte recordatorios.');

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ToUint8(clave),
    });
  }
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('No pude leer la suscripción del navegador.');
  await api('/push/suscribir', { method: 'POST', body: { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } } });
}

/** Desactiva los recordatorios en este dispositivo. */
export async function desactivarPush(): Promise<void> {
  if (!pushSoportado()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});
  await api('/push/baja', { method: 'POST', body: { endpoint } });
}

/** Envía una notificación de prueba a los dispositivos suscritos. */
export async function probarPush(): Promise<number> {
  const { enviados } = await api<{ enviados: number }>('/push/probar', { method: 'POST' });
  return enviados;
}
