import { prisma } from '../db.js';
import { hoyMX, horaMX, fechaDate } from '../lib/fecha.js';
import { get as getConfig } from '../settings/service.js';
import { enviarATodas, pushDisponible } from './service.js';

// ---------------------------------------------------------------------------
//  Scheduler de recordatorios. Cada minuto revisa qué avisos del día tocan
//  (peso, hábitos con hora, resumen de tareas) y los manda por Web Push.
//  Dedupe por día vía `recordatorios_enviados`, así un aviso no se repite
//  aunque el proceso reinicie o el minuto exacto se salte (usa hora >= objetivo).
// ---------------------------------------------------------------------------

const INTERVALO_MS = 60_000;

/** ¿La hora actual (HH:MM) ya alcanzó la hora objetivo? Comparación lexicográfica. */
function alcanzada(ahora: string, objetivo: string): boolean {
  return /^\d{2}:\d{2}$/.test(objetivo) && ahora >= objetivo;
}

async function yaEnviado(clave: string): Promise<boolean> {
  return (await prisma.recordatorios_enviados.count({ where: { clave } })) > 0;
}

/** Marca y envía. Marca aunque no haya suscriptores, para no reintentar todo el día. */
async function despachar(clave: string, title: string, body: string, url = '/') {
  try {
    await prisma.recordatorios_enviados.create({ data: { clave } });
  } catch {
    return; // carrera: otro tick ya lo marcó.
  }
  await enviarATodas({ title, body, url, tag: clave });
}

async function tick() {
  if (!pushDisponible()) return;
  const hoy = hoyMX();
  const ahora = horaMX();
  const fechaHoy = fechaDate(hoy);

  // --- Peso ---
  const horaPeso = await getConfig('peso_recordatorio_hora');
  if (horaPeso && alcanzada(ahora, horaPeso) && !(await yaEnviado(`peso:${hoy}`))) {
    const pesado = await prisma.peso_registros.count({ where: { fecha: fechaHoy } });
    if (!pesado) await despachar(`peso:${hoy}`, '⚖️ Hora de pesarte', 'Registra tu peso de hoy en Nodo Vida.', '/salud');
  }

  // --- Hábitos con hora de recordatorio ---
  const habitos = await prisma.habitos.findMany({ where: { activo: true, recordatorio_hora: { not: null } } });
  for (const h of habitos) {
    const hora = h.recordatorio_hora!;
    const clave = `habito:${h.id}:${hoy}`;
    if (!alcanzada(ahora, hora) || (await yaEnviado(clave))) continue;
    const hecho = await prisma.habito_registros.count({ where: { habito_id: h.id, fecha: fechaHoy, completado: true } });
    if (!hecho) await despachar(clave, '🔁 Hábito pendiente', `Te toca: ${h.nombre}.`, '/habitos');
  }

  // --- Resumen de tareas que vencen hoy ---
  const horaTareas = await getConfig('tareas_recordatorio_hora');
  if (horaTareas && alcanzada(ahora, horaTareas) && !(await yaEnviado(`tareas:${hoy}`))) {
    const pendientes = await prisma.tareas.count({ where: { estado: 'pendiente', fecha_vence: { lte: fechaHoy } } });
    if (pendientes > 0) {
      const txt = pendientes === 1 ? '1 tarea vence hoy.' : `${pendientes} tareas vencen hoy.`;
      await despachar(`tareas:${hoy}`, '✅ Agenda de hoy', `${txt} Ábrelas en Tareas.`, '/tareas');
    }
  }

  // Limpieza ligera: marcas de más de 3 días ya no sirven.
  await prisma.recordatorios_enviados.deleteMany({
    where: { creado_at: { lt: new Date(Date.now() - 3 * 86_400_000) } },
  });
}

export function iniciarScheduler() {
  if (!pushDisponible()) {
    console.log('🔕 Recordatorios push deshabilitados (sin claves VAPID).');
    return;
  }
  const correr = () => { tick().catch((e) => console.error('scheduler recordatorios:', e)); };
  setInterval(correr, INTERVALO_MS);
  setTimeout(correr, 5_000); // primera pasada poco después de arrancar.
  console.log('🔔 Scheduler de recordatorios activo (cada 60s).');
}
