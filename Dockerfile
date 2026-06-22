# Nodo Vida — imagen de un solo servicio (API + PWA).
# Debian slim (no Alpine) para evitar problemas de Prisma con musl/openssl.
FROM node:22-slim

RUN apt-get update -y && apt-get install -y openssl ca-certificates curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1) Manifests primero (mejor caché de capas). Instala TODAS las deps INCLUYENDO dev
#    (vite, tsc y el CLI de prisma hacen falta para build). --include=dev fuerza su
#    instalación aunque el entorno traiga NODE_ENV=production (caso de Coolify).
COPY package*.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm ci --include=dev

# 2) Código y build: prisma generate + (client -> server/public, server -> server/dist)
COPY . .
RUN npm run prisma:generate -w server && npm run build

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD curl -fsS http://localhost:3000/api/health || exit 1

# Aplica migraciones, siembra (idempotente: usuario + áreas + catálogos) y arranca.
CMD ["sh", "-c", "npx --workspace server prisma migrate deploy && npm run seed -w server && npm start"]
