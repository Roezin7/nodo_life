import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../middleware/error.js';
import { authRouter } from '../auth/routes.js';
import { areasRouter } from '../areas/routes.js';
import { settingsRouter } from '../settings/routes.js';
import { finanzasRouter } from '../finanzas/routes.js';
import { inversionesRouter } from '../inversiones/routes.js';
import { patrimonioRouter } from '../patrimonio/routes.js';
import { saludRouter } from '../salud/routes.js';
import { habitosRouter } from '../habitos/routes.js';
import { tareasRouter } from '../tareas/routes.js';
import { objetivosRouter } from '../objetivos/routes.js';
import { revisionesRouter } from '../revisiones/routes.js';
import { dashboardRouter } from '../revisiones/dashboard.js';
import { silviaRouter } from '../silvia/routes.js';
import { pushRouter } from '../push/routes.js';

export const apiRouter = Router();

apiRouter.get('/health', asyncHandler(async (_req, res) => {
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }
  res.status(db ? 200 : 503).json({ ok: db, servicio: 'nodo-vida', db, ts: new Date().toISOString() });
}));

apiRouter.use('/auth', authRouter); // Fase 0
apiRouter.use('/areas', areasRouter); // Fase 0
apiRouter.use('/settings', settingsRouter); // Fase 0
apiRouter.use('/finanzas', finanzasRouter); // Fase 1
apiRouter.use('/inversiones', inversionesRouter); // Fase 2
apiRouter.use('/patrimonio', patrimonioRouter); // Fase 3
apiRouter.use('/salud', saludRouter); // Fase 4
apiRouter.use('/habitos', habitosRouter); // Fase 5
apiRouter.use('/tareas', tareasRouter); // Fase 6
apiRouter.use('/objetivos', objetivosRouter); // Fase 7
apiRouter.use('/revisiones', revisionesRouter); // Fase 8
apiRouter.use('/dashboard', dashboardRouter); // Fase 8
apiRouter.use('/silvia', silviaRouter); // Fase 8
apiRouter.use('/push', pushRouter); // Recordatorios (Web Push)
