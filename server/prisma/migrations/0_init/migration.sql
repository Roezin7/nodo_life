-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ClaseCategoria" AS ENUM ('ingreso', 'gasto');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('ingreso', 'gasto', 'transferencia');

-- CreateEnum
CREATE TYPE "EstadoCobro" AS ENUM ('pendiente', 'cobrado');

-- CreateEnum
CREATE TYPE "EstadoDeuda" AS ENUM ('pendiente', 'pagado');

-- CreateEnum
CREATE TYPE "ClaseActivo" AS ENUM ('stock', 'etf', 'crypto');

-- CreateEnum
CREATE TYPE "EtapaTipo" AS ENUM ('deficit', 'volumen', 'mantenimiento');

-- CreateEnum
CREATE TYPE "TipoHabito" AS ENUM ('binario', 'numerico', 'tiempo');

-- CreateEnum
CREATE TYPE "FrecuenciaHabito" AS ENUM ('diaria', 'semanal_x_veces');

-- CreateEnum
CREATE TYPE "EstadoProyecto" AS ENUM ('activo', 'pausado', 'hecho');

-- CreateEnum
CREATE TYPE "PrioridadTarea" AS ENUM ('baja', 'media', 'alta');

-- CreateEnum
CREATE TYPE "EstadoTarea" AS ENUM ('pendiente', 'hecha');

-- CreateEnum
CREATE TYPE "HorizonteObjetivo" AS ENUM ('trimestral', 'anual');

-- CreateEnum
CREATE TYPE "EstadoObjetivo" AS ENUM ('activo', 'logrado', 'vencido');

-- CreateEnum
CREATE TYPE "FuenteVinculo" AS ENUM ('manual', 'habito', 'proyecto', 'kpi_financiero');

-- CreateEnum
CREATE TYPE "TipoRevision" AS ENUM ('diaria', 'semanal');

-- CreateTable
CREATE TABLE "usuario" (
    "id" BIGSERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "pin_hash" TEXT NOT NULL,
    "creado_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" BIGSERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '#1F8EF1',
    "icono" TEXT NOT NULL DEFAULT 'home',
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config" (
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "config_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "tipos_cuenta" (
    "id" BIGSERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "tipos_cuenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuentas" (
    "id" BIGSERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo_id" BIGINT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'MXN',
    "saldo_inicial" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "es_central" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuentas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" BIGSERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "clase" "ClaseCategoria" NOT NULL,
    "area_id" BIGINT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos" (
    "id" BIGSERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "cuenta_origen_id" BIGINT,
    "cuenta_destino_id" BIGINT,
    "categoria_id" BIGINT,
    "area_id" BIGINT,
    "descripcion" TEXT,
    "creado_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "por_cobrar" (
    "id" BIGSERIAL NOT NULL,
    "descripcion" TEXT NOT NULL,
    "deudor" TEXT,
    "monto" DECIMAL(14,2) NOT NULL,
    "fecha" DATE NOT NULL,
    "estado" "EstadoCobro" NOT NULL DEFAULT 'pendiente',
    "creado_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "por_cobrar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deudas" (
    "id" BIGSERIAL NOT NULL,
    "descripcion" TEXT NOT NULL,
    "acreedor" TEXT,
    "monto" DECIMAL(14,2) NOT NULL,
    "fecha" DATE NOT NULL,
    "estado" "EstadoDeuda" NOT NULL DEFAULT 'pendiente',
    "creado_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deudas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presupuestos" (
    "id" BIGSERIAL NOT NULL,
    "categoria_id" BIGINT,
    "area_id" BIGINT,
    "periodo" TEXT NOT NULL DEFAULT 'mensual',
    "monto_limite" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "presupuestos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posiciones" (
    "id" BIGSERIAL NOT NULL,
    "ticker" TEXT NOT NULL,
    "nombre" TEXT,
    "clase" "ClaseActivo" NOT NULL DEFAULT 'etf',
    "cantidad" DECIMAL(18,6) NOT NULL,
    "precio_compra_prom" DECIMAL(18,4) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "fecha_inicio" DATE,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "posiciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "precios_cache" (
    "ticker" TEXT NOT NULL,
    "precio_actual" DECIMAL(18,4) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "actualizado_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "precios_cache_pkey" PRIMARY KEY ("ticker")
);

-- CreateTable
CREATE TABLE "fx_cache" (
    "par" TEXT NOT NULL,
    "tasa" DECIMAL(18,6) NOT NULL,
    "actualizado_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fx_cache_pkey" PRIMARY KEY ("par")
);

-- CreateTable
CREATE TABLE "snapshots_patrimonio" (
    "id" BIGSERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "total_activos" DECIMAL(14,2) NOT NULL,
    "total_pasivos" DECIMAL(14,2) NOT NULL,
    "patrimonio_neto" DECIMAL(14,2) NOT NULL,
    "desglose_json" JSONB NOT NULL,
    "creado_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snapshots_patrimonio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "peso_registros" (
    "id" BIGSERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "hora" TEXT,
    "peso" DECIMAL(6,2) NOT NULL,

    CONSTRAINT "peso_registros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etapa_actual" (
    "id" BIGSERIAL NOT NULL,
    "tipo" "EtapaTipo",
    "desde" DATE,
    "nota" TEXT,

    CONSTRAINT "etapa_actual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_entrenamiento" (
    "id" BIGSERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "tipos_entrenamiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entrenamientos" (
    "id" BIGSERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "tipo_id" BIGINT NOT NULL,
    "duracion_min" INTEGER,
    "notas" TEXT,
    "metricas_json" JSONB,
    "creado_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entrenamientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entrenamiento_series" (
    "id" BIGSERIAL NOT NULL,
    "entrenamiento_id" BIGINT NOT NULL,
    "ejercicio" TEXT NOT NULL,
    "series" INTEGER,
    "reps" INTEGER,
    "peso" DECIMAL(8,2),

    CONSTRAINT "entrenamiento_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habitos" (
    "id" BIGSERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "area_id" BIGINT NOT NULL,
    "tipo" "TipoHabito" NOT NULL DEFAULT 'binario',
    "frecuencia" "FrecuenciaHabito" NOT NULL DEFAULT 'diaria',
    "meta" DECIMAL(10,2),
    "recordatorio_hora" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "habitos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habito_registros" (
    "id" BIGSERIAL NOT NULL,
    "habito_id" BIGINT NOT NULL,
    "fecha" DATE NOT NULL,
    "valor" DECIMAL(10,2),
    "completado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "habito_registros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proyectos" (
    "id" BIGSERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "area_id" BIGINT NOT NULL,
    "estado" "EstadoProyecto" NOT NULL DEFAULT 'activo',
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creado_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proyectos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tareas" (
    "id" BIGSERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "area_id" BIGINT NOT NULL,
    "proyecto_id" BIGINT,
    "prioridad" "PrioridadTarea" NOT NULL DEFAULT 'media',
    "fecha_vence" DATE,
    "recurrencia" TEXT,
    "estado" "EstadoTarea" NOT NULL DEFAULT 'pendiente',
    "notas" TEXT,
    "completado_at" TIMESTAMPTZ(6),
    "creado_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tareas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proyecto_avances" (
    "id" BIGSERIAL NOT NULL,
    "proyecto_id" BIGINT NOT NULL,
    "fecha" DATE NOT NULL,
    "nota" TEXT NOT NULL,

    CONSTRAINT "proyecto_avances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objetivos" (
    "id" BIGSERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "area_id" BIGINT NOT NULL,
    "horizonte" "HorizonteObjetivo" NOT NULL DEFAULT 'trimestral',
    "metrica" TEXT,
    "unidad" TEXT,
    "meta_valor" DECIMAL(14,2) NOT NULL,
    "valor_actual" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "fecha_inicio" DATE,
    "fecha_fin" DATE,
    "estado" "EstadoObjetivo" NOT NULL DEFAULT 'activo',
    "creado_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "objetivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objetivo_vinculos" (
    "id" BIGSERIAL NOT NULL,
    "objetivo_id" BIGINT NOT NULL,
    "fuente" "FuenteVinculo" NOT NULL,
    "ref_id" BIGINT,

    CONSTRAINT "objetivo_vinculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revisiones" (
    "id" BIGSERIAL NOT NULL,
    "tipo" "TipoRevision" NOT NULL,
    "fecha" DATE NOT NULL,
    "notas" TEXT,
    "ia_resumen_json" JSONB,
    "creado_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revisiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "silvia_mensajes" (
    "id" BIGSERIAL NOT NULL,
    "rol" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "creado_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "silvia_mensajes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "silvia_memoria" (
    "id" BIGSERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "fecha" DATE,
    "creado_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "silvia_memoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "areas_nombre_key" ON "areas"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_cuenta_nombre_key" ON "tipos_cuenta"("nombre");

-- CreateIndex
CREATE INDEX "cuentas_tipo_id_idx" ON "cuentas"("tipo_id");

-- CreateIndex
CREATE INDEX "categorias_area_id_idx" ON "categorias"("area_id");

-- CreateIndex
CREATE INDEX "movimientos_fecha_idx" ON "movimientos"("fecha");

-- CreateIndex
CREATE INDEX "movimientos_categoria_id_idx" ON "movimientos"("categoria_id");

-- CreateIndex
CREATE INDEX "movimientos_area_id_idx" ON "movimientos"("area_id");

-- CreateIndex
CREATE INDEX "presupuestos_categoria_id_idx" ON "presupuestos"("categoria_id");

-- CreateIndex
CREATE INDEX "presupuestos_area_id_idx" ON "presupuestos"("area_id");

-- CreateIndex
CREATE UNIQUE INDEX "snapshots_patrimonio_fecha_key" ON "snapshots_patrimonio"("fecha");

-- CreateIndex
CREATE INDEX "peso_registros_fecha_idx" ON "peso_registros"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "peso_registros_fecha_key" ON "peso_registros"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_entrenamiento_nombre_key" ON "tipos_entrenamiento"("nombre");

-- CreateIndex
CREATE INDEX "entrenamientos_fecha_idx" ON "entrenamientos"("fecha");

-- CreateIndex
CREATE INDEX "entrenamientos_tipo_id_idx" ON "entrenamientos"("tipo_id");

-- CreateIndex
CREATE INDEX "entrenamiento_series_entrenamiento_id_idx" ON "entrenamiento_series"("entrenamiento_id");

-- CreateIndex
CREATE INDEX "habitos_area_id_idx" ON "habitos"("area_id");

-- CreateIndex
CREATE INDEX "habito_registros_habito_id_idx" ON "habito_registros"("habito_id");

-- CreateIndex
CREATE UNIQUE INDEX "habito_registros_habito_id_fecha_key" ON "habito_registros"("habito_id", "fecha");

-- CreateIndex
CREATE INDEX "proyectos_area_id_idx" ON "proyectos"("area_id");

-- CreateIndex
CREATE INDEX "tareas_area_id_idx" ON "tareas"("area_id");

-- CreateIndex
CREATE INDEX "tareas_proyecto_id_idx" ON "tareas"("proyecto_id");

-- CreateIndex
CREATE INDEX "tareas_fecha_vence_idx" ON "tareas"("fecha_vence");

-- CreateIndex
CREATE INDEX "proyecto_avances_proyecto_id_idx" ON "proyecto_avances"("proyecto_id");

-- CreateIndex
CREATE INDEX "objetivos_area_id_idx" ON "objetivos"("area_id");

-- CreateIndex
CREATE INDEX "objetivo_vinculos_objetivo_id_idx" ON "objetivo_vinculos"("objetivo_id");

-- CreateIndex
CREATE INDEX "revisiones_fecha_idx" ON "revisiones"("fecha");

-- AddForeignKey
ALTER TABLE "cuentas" ADD CONSTRAINT "cuentas_tipo_id_fkey" FOREIGN KEY ("tipo_id") REFERENCES "tipos_cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_cuenta_origen_id_fkey" FOREIGN KEY ("cuenta_origen_id") REFERENCES "cuentas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_cuenta_destino_id_fkey" FOREIGN KEY ("cuenta_destino_id") REFERENCES "cuentas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrenamientos" ADD CONSTRAINT "entrenamientos_tipo_id_fkey" FOREIGN KEY ("tipo_id") REFERENCES "tipos_entrenamiento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrenamiento_series" ADD CONSTRAINT "entrenamiento_series_entrenamiento_id_fkey" FOREIGN KEY ("entrenamiento_id") REFERENCES "entrenamientos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habitos" ADD CONSTRAINT "habitos_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habito_registros" ADD CONSTRAINT "habito_registros_habito_id_fkey" FOREIGN KEY ("habito_id") REFERENCES "habitos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyecto_avances" ADD CONSTRAINT "proyecto_avances_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objetivos" ADD CONSTRAINT "objetivos_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objetivo_vinculos" ADD CONSTRAINT "objetivo_vinculos_objetivo_id_fkey" FOREIGN KEY ("objetivo_id") REFERENCES "objetivos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

