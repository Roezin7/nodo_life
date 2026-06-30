import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url().or(z.string().startsWith('postgres')),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET debe tener al menos 16 caracteres'),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  // Proveedor de precios de inversiones (Finnhub gratis). Vacío = el módulo no valúa.
  FINNHUB_API_KEY: z.string().optional().default(''),
  // Orígenes permitidos para CORS, separados por coma. Vacío = solo mismo origen.
  ALLOWED_ORIGINS: z.string().optional().default(''),
  // Web Push (recordatorios). Genera el par con `npx web-push generate-vapid-keys`.
  // Vacío = los recordatorios push quedan deshabilitados (la app sigue funcionando).
  VAPID_PUBLIC_KEY: z.string().optional().default(''),
  VAPID_PRIVATE_KEY: z.string().optional().default(''),
  VAPID_SUBJECT: z.string().optional().default('mailto:nodo@vida.app'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variables de entorno inválidas:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
