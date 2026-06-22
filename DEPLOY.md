# Deploy de Nodo Vida (Coolify — un solo servicio)

Nodo Vida es **un solo servicio**: el servidor Node sirve la API (`/api/*`) **y** la PWA
compilada (todo lo demás). No hay frontend separado.

## Coolify

1. **Nuevo recurso → Application → desde tu repositorio Git** (o Dockerfile).
2. **Build Pack: Dockerfile** (el `Dockerfile` en la raíz ya está listo).
   - Hace `npm ci`, `prisma generate`, build de client→`server/public` y server→`server/dist`.
   - Al arrancar: `prisma migrate deploy` + seed idempotente + `npm start`.
3. **Puerto:** 3000. **Health check:** `/api/health`.
4. **Environment Variables** (pégalas en Coolify; el `.env` local NO entra a la imagen):

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | tu Postgres de Coolify (interno: `postgres://postgres:…@<host-interno>:5432/postgres`) |
   | `JWT_SECRET` | cadena larga aleatoria (≥16 chars) |
   | `NODE_ENV` | `production` |
   | `ANTHROPIC_API_KEY` | (opcional) habilita a Silvia y la captura asistida |
   | `FINNHUB_API_KEY` | (opcional) valúa inversiones a mercado |
   | `ALLOWED_ORIGINS` | vacío (mismo origen) |
   | `SEED_PIN` | PIN inicial (ej. `1234`) — **cámbialo desde la app** |
   | `SEED_NOMBRE` | tu nombre |

5. **Postgres:** crea una base Postgres en Coolify en el mismo proyecto y usa su
   `DATABASE_URL` **interno** (el host es el nombre del servicio, no `localhost`).

## Primer login

Tras el primer arranque, el seed crea: el usuario único (PIN = `SEED_PIN`), las 4 áreas
de vida, tipos de cuenta + cuentas iniciales (Banco/Efectivo/Inversiones), categorías y
los tipos de entrenamiento (Pesas/Correr/HIIT). Entra con el PIN y cámbialo en
**Configuración → Perfil**.

## Local

```bash
cp server/.env.example server/.env   # rellena DATABASE_URL y JWT_SECRET
npm install
npm run prisma:migrate -w server     # o prisma migrate deploy si ya hay migraciones
npm run seed
npm run dev                          # API :3000 + Vite :5173 (proxy /api)
```

## Notas

- **Offline-first:** las escrituras se encolan en IndexedDB y se sincronizan al reconectar.
- **IA acotada:** Silvia nunca escribe en tus datos; propone un borrador editable que tú confirmas.
- **Zona horaria:** America/Mexico_City. **Moneda base:** MXN.
