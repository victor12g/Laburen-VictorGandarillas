-- Borrar tablas anteriores para evitar conflictos
DROP TABLE IF EXISTS cart_items;

DROP TABLE IF EXISTS products;

DROP TABLE IF EXISTS carts;

-- Products Table
CREATE TABLE products (
    "ID" TEXT PRIMARY KEY,
    "TIPO_PRENDA" TEXT,
    "TALLA" TEXT,
    "COLOR" TEXT,
    "CANTIDAD_DISPONIBLE" INTEGER DEFAULT 0,
    "PRECIO_50_U" DECIMAL(10, 2),
    "PRECIO_100_U" DECIMAL(10, 2),
    "PRECIO_200_U" DECIMAL(10, 2),
    "DISPONIBLE" TEXT,
    "CATEGORÍA" TEXT,
    "DESCRIPCIÓN" TEXT,
    "image_url" TEXT 
);

-- Carts Table
CREATE TABLE carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cart Items Table
CREATE TABLE cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    cart_id UUID REFERENCES carts (id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products ("ID"),
    qty INTEGER NOT NULL CHECK (qty > 0),
    UNIQUE (cart_id, product_id)
);

