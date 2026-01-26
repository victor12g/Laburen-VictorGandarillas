-- Borrar tablas anteriores para evitar conflictos
DROP TABLE IF EXISTS cart_items;

DROP TABLE IF EXISTS products;

DROP TABLE IF EXISTS carts;

-- Products Table (Nombres de columnas EXACTOS al Excel para mapeo automático)
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
    "DESCRIPCIÓN" TEXT
);

-- Carts Table (un carrito por conversación, usa conversation_id de Laburen)
CREATE TABLE carts (
    id TEXT PRIMARY KEY, -- conversation_id de Laburen/Chatwoot
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cart Items Table
CREATE TABLE cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    cart_id TEXT REFERENCES carts (id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products ("ID"),
    qty INTEGER NOT NULL CHECK (qty > 0),
    UNIQUE (cart_id, product_id)
);