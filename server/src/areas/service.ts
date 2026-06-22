import { prisma } from '../db.js';
import { HttpError } from '../middleware/error.js';

export interface AreaDTO {
  id: number;
  nombre: string;
  orden: number;
  color: string;
  icono: string;
  activo: boolean;
}

function serializar(a: { id: bigint; nombre: string; orden: number; color: string; icono: string; activo: boolean }): AreaDTO {
  return { id: Number(a.id), nombre: a.nombre, orden: a.orden, color: a.color, icono: a.icono, activo: a.activo };
}

/** Lista de áreas. Por defecto solo activas (para selectores); todas en config. */
export async function listar(incluirInactivas = false): Promise<AreaDTO[]> {
  const areas = await prisma.areas.findMany({
    where: incluirInactivas ? {} : { activo: true },
    orderBy: [{ orden: 'asc' }, { id: 'asc' }],
  });
  return areas.map(serializar);
}

export async function crear(data: { nombre: string; color?: string; icono?: string }): Promise<AreaDTO> {
  const max = await prisma.areas.aggregate({ _max: { orden: true } });
  const a = await prisma.areas.create({
    data: {
      nombre: data.nombre,
      color: data.color ?? '#1F8EF1',
      icono: data.icono ?? 'home',
      orden: (max._max.orden ?? 0) + 1,
    },
  });
  return serializar(a);
}

export async function editar(id: bigint, data: { nombre?: string; color?: string; icono?: string; orden?: number; activo?: boolean }): Promise<AreaDTO> {
  const existe = await prisma.areas.findUnique({ where: { id } });
  if (!existe) throw new HttpError(404, 'Área no encontrada');
  const a = await prisma.areas.update({ where: { id }, data });
  return serializar(a);
}
