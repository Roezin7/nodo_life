import './lib/bigint.js'; // habilita JSON.stringify de BigInt (debe ir primero)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { env, isProd } from './env.js';
import { apiRouter } from './routes/index.js';
import { errorHandler } from './middleware/error.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');

const app = express();

if (isProd) app.set('trust proxy', 1);

app.use(compression());

// CSP para producción: la PWA usa un script inline (bootstrap de tema), Google Fonts
// y previews de imagen en data:.
const csp = {
  useDefaults: true,
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    imgSrc: ["'self'", 'data:'],
    connectSrc: ["'self'"],
    workerSrc: ["'self'"],
    objectSrc: ["'none'"],
    frameAncestors: ["'self'"],
    upgradeInsecureRequests: [],
  },
};
app.use(helmet({ contentSecurityPolicy: isProd ? csp : false }));

const origenes = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origenes.length ? origenes : false }));

app.use(express.json({ limit: '10mb' })); // 10mb para imágenes del borrador IA

// --- Rate limiting ---
const limiteGeneral = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.originalUrl.startsWith('/api/auth/login'),
});
const limiteLogin = rateLimit({
  windowMs: 15 * 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Espera unos minutos e intenta de nuevo.' },
});

app.use('/api/auth/login', limiteLogin);
app.use('/api', limiteGeneral);
app.use('/api', apiRouter);

// --- PWA estática (single-service) ---
app.use(
  express.static(publicDir, {
    setHeaders: (res, filePath) => {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }),
);
app.get(/^(?!\/api).*/, (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.use(errorHandler);

// Bind explícito a 0.0.0.0 para que el proxy (Traefik/Coolify) alcance el
// contenedor por la red interna de Docker (evita "no available server").
app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`🌱 Nodo Vida API + PWA escuchando en http://0.0.0.0:${env.PORT}`);
});
