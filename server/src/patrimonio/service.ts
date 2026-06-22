import { prisma } from '../db.js';
import { num0 } from '../lib/num.js';
import { HttpError } from '../middleware/error.js';
import { iso, fechaDate, hoyMX } from '../lib/fecha.js';
import { redondear } from '../finanzas/logic.js';
import { saldosActuales, totalesCobrarDeudas } from '../finanzas/service.js';
import { valorPortafolioMXN } from '../inversiones/service.js';

export interface Desglose {
  cuentas: { cuenta_id: number; nombre: string; saldo: number }[];
  inversiones_mxn: number;
  por_cobrar: number;
  deudas: number;
}

export interface PatrimonioVivo {
  fecha: string;
  total_activos: number;
  total_pasivos: number;
  patrimonio_neto: number;
  desglose: Desglose;
}

/** Calcula el patrimonio actual EN VIVO (sin guardar). */
export async function patrimonioActual(): Promise<PatrimonioVivo> {
  const [saldos, cobrarDeudas, inversionesMXN] = await Promise.all([
    saldosActuales(),
    totalesCobrarDeudas(),
    valorPortafolioMXN(),
  ]);
  const totalCuentas = redondear(saldos.reduce((a, s) => a + s.saldo, 0));
  const total_activos = redondear(totalCuentas + inversionesMXN + cobrarDeudas.por_cobrar);
  const total_pasivos = redondear(cobrarDeudas.deudas);
  return {
    fecha: hoyMX(),
    total_activos,
    total_pasivos,
    patrimonio_neto: redondear(total_activos - total_pasivos),
    desglose: {
      cuentas: saldos.map((s) => ({ cuenta_id: s.cuenta_id, nombre: s.nombre, saldo: s.saldo })),
      inversiones_mxn: inversionesMXN,
      por_cobrar: cobrarDeudas.por_cobrar,
      deudas: cobrarDeudas.deudas,
    },
  };
}

/** Congela un snapshot de patrimonio para la fecha dada (hoy por defecto). Upsert por fecha. */
export async function generarSnapshot(fechaStr?: string) {
  const vivo = await patrimonioActual();
  const fecha = fechaDate(fechaStr ?? vivo.fecha);
  const snap = await prisma.snapshots_patrimonio.upsert({
    where: { fecha },
    update: {
      total_activos: vivo.total_activos,
      total_pasivos: vivo.total_pasivos,
      patrimonio_neto: vivo.patrimonio_neto,
      desglose_json: vivo.desglose as object,
    },
    create: {
      fecha,
      total_activos: vivo.total_activos,
      total_pasivos: vivo.total_pasivos,
      patrimonio_neto: vivo.patrimonio_neto,
      desglose_json: vivo.desglose as object,
    },
  });
  return { id: Number(snap.id), fecha: iso(snap.fecha) };
}

/** Serie de snapshots (tendencia del patrimonio neto en el tiempo). */
export async function listarSnapshots() {
  const snaps = await prisma.snapshots_patrimonio.findMany({ orderBy: { fecha: 'asc' } });
  return snaps.map((s) => ({
    id: Number(s.id),
    fecha: iso(s.fecha),
    total_activos: num0(s.total_activos),
    total_pasivos: num0(s.total_pasivos),
    patrimonio_neto: num0(s.patrimonio_neto),
    desglose: s.desglose_json,
  }));
}

export async function borrarSnapshot(id: bigint) {
  const existe = await prisma.snapshots_patrimonio.findUnique({ where: { id } });
  if (!existe) throw new HttpError(404, 'Snapshot no encontrado');
  await prisma.snapshots_patrimonio.delete({ where: { id } });
  return { ok: true };
}

/** ¿Conviene sugerir un snapshot? (no hay ninguno, o el último es más viejo que la cadencia). */
export async function sugerirSnapshot(cadenciaDias: number): Promise<boolean> {
  const ult = await prisma.snapshots_patrimonio.findFirst({ orderBy: { fecha: 'desc' } });
  if (!ult) return true;
  const dias = (Date.now() - ult.fecha.getTime()) / 86_400_000;
  return dias >= cadenciaDias;
}
