-- Migration: Agregar campos total a carts y price a cart_items
-- Fecha: 2026-01-26
-- Descripción: Almacenar total del carrito y precio unitario de cada item para auditoría y reporting

-- Agregar columna total a carts
ALTER TABLE carts
ADD COLUMN IF NOT EXISTS total DECIMAL(12, 2) DEFAULT 0;

-- Agregar columna price a cart_items
ALTER TABLE cart_items
ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2);

-- Actualizar cart_items.price con los precios actuales basados en cantidad
-- Esto necesita ejecutarse manualmente ya que no tenemos histórico de precios
-- UPDATE cart_items
-- SET price = CASE
--     WHEN qty >= 200 THEN (SELECT price_200_u FROM products WHERE products.id = cart_items.product_id)
--     WHEN qty >= 100 THEN (SELECT price_100_u FROM products WHERE products.id = cart_items.product_id)
--     ELSE (SELECT price_50_u FROM products WHERE products.id = cart_items.product_id)
-- END
-- WHERE price IS NULL;
