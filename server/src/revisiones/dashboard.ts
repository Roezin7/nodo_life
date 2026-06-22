import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../auth/middleware.js';
import { hoyMX } from '../lib/fecha.js';
import { tracker } from '../habitos/service.js';
import { listarTareas } from '../tareas/service.js';
import { listarProyectos } from '../tareas/service.js';
import { tendenciaPeso } from '../salud/service.js';
import { patrimonioActual } from '../patrimonio/service.js';
import { portafolio } from '../inversiones/service.js';
import { listar as listarObjetivos } from '../objetivos/service.js';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

/** Vista holística "home": de un vistazo, el progreso real de la vida en todas las áreas. */
dashboardRouter.get('/', asyncHandler(async (_req, res) => {
  const hoy = hoyMX();
  const [habitos, tareasHoy, proyectos, peso, patrimonio, port, objetivos] = await Promise.all([
    tracker(),
    listarTareas('hoy'),
    listarProyectos(false),
    tendenciaPeso(60),
    patrimonioActual(),
    portafolio().catch(() => null), // las inversiones dependen de red; no deben tumbar el home
    listarObjetivos(),
  ]);

  res.json({
    fecha: hoy,
    habitos: {
      total: habitos.habitos.length,
      hechos_hoy: habitos.habitos.filter((h) => h.hecho_hoy).length,
      lista: habitos.habitos.map((h) => ({
        id: h.id, nombre: h.nombre, area_color: h.area_color, hecho_hoy: h.hecho_hoy, racha: h.racha,
      })),
    },
    tareas_hoy: tareasHoy,
    proyectos_activos: proyectos.filter((p) => p.estado === 'activo'),
    peso: { ultimo: peso.ultimo, variacion: peso.variacion_periodo, serie: peso.serie.slice(-30) },
    patrimonio: {
      neto: patrimonio.patrimonio_neto,
      activos: patrimonio.total_activos,
      pasivos: patrimonio.total_pasivos,
      portafolio_mxn: port?.totales.valor_mxn ?? null,
      portafolio_pnl: port?.totales.pnl_mxn ?? null,
    },
    objetivos: objetivos.map((o) => ({
      id: o.id, nombre: o.nombre, area_color: o.area_color, progreso: o.progreso, estado: o.estado,
      meta_valor: o.meta_valor, valor_actual: o.valor_actual, unidad: o.unidad,
    })),
  });
}));
