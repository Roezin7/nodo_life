-- Integración Schwab en modo solo lectura: OAuth cifrado, cuentas, posiciones y operaciones.

ALTER TABLE "posiciones"
ADD COLUMN "fuente" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN "broker_cuenta_id" BIGINT;

CREATE TABLE "broker_conexiones" (
    "id" BIGSERIAL NOT NULL,
    "proveedor" TEXT NOT NULL DEFAULT 'schwab',
    "alias" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "access_token_enc" TEXT,
    "refresh_token_enc" TEXT,
    "access_expira_at" TIMESTAMPTZ(6),
    "refresh_expira_at" TIMESTAMPTZ(6),
    "scope" TEXT,
    "ultimo_sync_at" TIMESTAMPTZ(6),
    "ultimo_error" TEXT,
    "creado_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broker_conexiones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "broker_conexiones_proveedor_key" ON "broker_conexiones"("proveedor");

CREATE TABLE "broker_cuentas" (
    "id" BIGSERIAL NOT NULL,
    "conexion_id" BIGINT NOT NULL,
    "hash_cuenta" TEXT NOT NULL,
    "cuenta_mascara" TEXT,
    "tipo" TEXT,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "saldo_efectivo" DECIMAL(18,2),
    "valor_cuenta" DECIMAL(18,2),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_sync_at" TIMESTAMPTZ(6),
    "creado_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broker_cuentas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "broker_cuentas_conexion_id_hash_cuenta_key" ON "broker_cuentas"("conexion_id", "hash_cuenta");
CREATE INDEX "broker_cuentas_conexion_id_idx" ON "broker_cuentas"("conexion_id");

CREATE TABLE "broker_operaciones" (
    "id" BIGSERIAL NOT NULL,
    "broker_cuenta_id" BIGINT NOT NULL,
    "external_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "lado" TEXT,
    "ticker" TEXT,
    "descripcion" TEXT,
    "cantidad" DECIMAL(18,6),
    "precio" DECIMAL(18,6),
    "monto" DECIMAL(18,2),
    "comisiones" DECIMAL(18,2),
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "fecha" DATE NOT NULL,
    "ejecutada_at" TIMESTAMPTZ(6),
    "datos_json" JSONB,
    "creado_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broker_operaciones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "broker_operaciones_broker_cuenta_id_external_id_key" ON "broker_operaciones"("broker_cuenta_id", "external_id");
CREATE INDEX "broker_operaciones_fecha_idx" ON "broker_operaciones"("fecha");
CREATE INDEX "broker_operaciones_ticker_idx" ON "broker_operaciones"("ticker");

CREATE TABLE "broker_oauth_states" (
    "estado" TEXT NOT NULL,
    "conexion_id" BIGINT NOT NULL,
    "expira_at" TIMESTAMPTZ(6) NOT NULL,
    "creado_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broker_oauth_states_pkey" PRIMARY KEY ("estado")
);

CREATE INDEX "broker_oauth_states_expira_at_idx" ON "broker_oauth_states"("expira_at");
CREATE INDEX "posiciones_broker_cuenta_id_idx" ON "posiciones"("broker_cuenta_id");
CREATE UNIQUE INDEX "posiciones_broker_cuenta_id_ticker_key" ON "posiciones"("broker_cuenta_id", "ticker");

ALTER TABLE "posiciones" ADD CONSTRAINT "posiciones_broker_cuenta_id_fkey"
    FOREIGN KEY ("broker_cuenta_id") REFERENCES "broker_cuentas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "broker_cuentas" ADD CONSTRAINT "broker_cuentas_conexion_id_fkey"
    FOREIGN KEY ("conexion_id") REFERENCES "broker_conexiones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "broker_operaciones" ADD CONSTRAINT "broker_operaciones_broker_cuenta_id_fkey"
    FOREIGN KEY ("broker_cuenta_id") REFERENCES "broker_cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "broker_oauth_states" ADD CONSTRAINT "broker_oauth_states_conexion_id_fkey"
    FOREIGN KEY ("conexion_id") REFERENCES "broker_conexiones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
