-- Revoca sesiones al cambiar PIN y evita duplicados al reintentar mutaciones offline.

ALTER TABLE "usuario"
ADD COLUMN "sesion_version" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "idempotency_keys" (
    "clave" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "respuesta" JSONB NOT NULL,
    "creado_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("clave")
);

CREATE INDEX "idempotency_keys_creado_at_idx" ON "idempotency_keys"("creado_at");
