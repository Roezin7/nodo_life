-- Activos físicos no líquidos (casa, carro…): suman al patrimonio, fuera del flujo.

-- CreateEnum
CREATE TYPE "CategoriaActivoFisico" AS ENUM ('inmueble', 'vehiculo', 'otro');

-- CreateTable
CREATE TABLE "activos_fisicos" (
    "id" BIGSERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" "CategoriaActivoFisico" NOT NULL DEFAULT 'otro',
    "valor" DECIMAL(14,2) NOT NULL,
    "nota" TEXT,
    "fecha_valuacion" DATE NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activos_fisicos_pkey" PRIMARY KEY ("id")
);
