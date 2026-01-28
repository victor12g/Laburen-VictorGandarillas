-- Rename products table columns to standard naming conventions
-- Preserves all existing data

-- Column mapping:
-- ID → id
-- TIPO_PRENDA → name
-- TALLA → size
-- COLOR → color
-- CANTIDAD_DISPONIBLE → stock
-- PRECIO_50_U → price_50_u
-- PRECIO_100_U → price_100_u
-- PRECIO_200_U → price_200_u
-- DISPONIBLE → available
-- CATEGORÍA → category
-- DESCRIPCIÓN → description

-- Paso 1: Renombrar columnas existentes
ALTER TABLE products RENAME COLUMN "ID" TO id;
ALTER TABLE products RENAME COLUMN "TIPO_PRENDA" TO name;
ALTER TABLE products RENAME COLUMN "TALLA" TO size;
ALTER TABLE products RENAME COLUMN "COLOR" TO color;
ALTER TABLE products RENAME COLUMN "CANTIDAD_DISPONIBLE" TO stock;
ALTER TABLE products RENAME COLUMN "PRECIO_50_U" TO price_50_u;
ALTER TABLE products RENAME COLUMN "PRECIO_100_U" TO price_100_u;
ALTER TABLE products RENAME COLUMN "PRECIO_200_U" TO price_200_u;
ALTER TABLE products RENAME COLUMN "DISPONIBLE" TO available;
ALTER TABLE products RENAME COLUMN "CATEGORÍA" TO category;
ALTER TABLE products RENAME COLUMN "DESCRIPCIÓN" TO description;

-- Paso 2: Actualizar foreign key en cart_items
ALTER TABLE cart_items 
DROP CONSTRAINT IF EXISTS cart_items_product_id_fkey;

ALTER TABLE cart_items 
ADD CONSTRAINT cart_items_product_id_fkey 
FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
