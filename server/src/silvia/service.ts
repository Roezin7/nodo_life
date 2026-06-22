import { prisma } from '../db.js';
import { conversar } from './agent.js';

export async function chat(mensaje: string) {
  await prisma.silvia_mensajes.create({ data: { rol: 'user', contenido: mensaje } });
  const r = await conversar(mensaje);
  await prisma.silvia_mensajes.create({ data: { rol: 'assistant', contenido: r.texto } });
  return r;
}

export async function historial() {
  const msgs = await prisma.silvia_mensajes.findMany({ orderBy: { id: 'asc' }, take: 100 });
  return msgs.map((m) => ({ id: Number(m.id), rol: m.rol, contenido: m.contenido, creado_at: m.creado_at.toISOString() }));
}

export async function listarMemoria() {
  const mem = await prisma.silvia_memoria.findMany({ orderBy: { id: 'desc' } });
  return mem.map((m) => ({
    id: Number(m.id),
    tipo: m.tipo,
    contenido: m.contenido,
    fecha: m.fecha ? m.fecha.toISOString().slice(0, 10) : null,
  }));
}

export async function registrarEvento(contenido: string, fecha?: string) {
  const e = await prisma.silvia_memoria.create({
    data: { tipo: 'evento', contenido, fecha: fecha ? new Date(fecha + 'T00:00:00Z') : null },
  });
  return { id: Number(e.id) };
}

export async function borrarMemoria(id: bigint) {
  await prisma.silvia_memoria.deleteMany({ where: { id } });
  return { ok: true };
}

export async function borrarHistorial() {
  await prisma.silvia_mensajes.deleteMany({});
  return { ok: true };
}
