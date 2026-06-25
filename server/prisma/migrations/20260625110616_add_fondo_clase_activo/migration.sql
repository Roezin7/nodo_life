-- Agrega la clase 'fondo' (fondos mutuos, p.ej. SWPPX) al enum de inversiones.
ALTER TYPE "ClaseActivo" ADD VALUE IF NOT EXISTS 'fondo';
