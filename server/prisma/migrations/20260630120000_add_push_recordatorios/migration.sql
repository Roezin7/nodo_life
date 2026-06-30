-- Web Push: suscripciones por dispositivo + dedupe de recordatorios enviados.

-- CreateTable
CREATE TABLE "push_suscripciones" (
    "id" BIGSERIAL NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "creado_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_suscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recordatorios_enviados" (
    "clave" TEXT NOT NULL,
    "creado_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recordatorios_enviados_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_suscripciones_endpoint_key" ON "push_suscripciones"("endpoint");
