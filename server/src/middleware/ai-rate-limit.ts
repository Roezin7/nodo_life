import rateLimit from 'express-rate-limit';

// Las operaciones que llaman a un proveedor externo tienen un límite propio,
// separado del límite general de la API.
export const limiteIA = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de IA. Espera un minuto e intenta de nuevo.' },
});
