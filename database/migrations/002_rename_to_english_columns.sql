-- Migración: Convertir nombres de columnas restantes al inglés
-- Fecha: 2026-01-26
-- IMPORTANTE: Esta migración convierte nombres en español que quedaron pendientes

-- Mapeo de columnas pendientes:
-- talla → size
-- precio_50_u → price_50_u
-- precio_100_u → price_100_u
-- precio_200_u → price_200_u
-- disponible → available

-- Paso 1: Renombrar columnas restantes
ALTER TABLE products RENAME COLUMN talla TO size;
ALTER TABLE products RENAME COLUMN precio_50_u TO price_50_u;
ALTER TABLE products RENAME COLUMN precio_100_u TO price_100_u;
ALTER TABLE products RENAME COLUMN precio_200_u TO price_200_u;
ALTER TABLE products RENAME COLUMN disponible TO available;

-- Migración completada
-- Estructura final de products:
-- id, name, description, price_100_u, stock, size, color, available, category, price_50_u, price_200_u
