-- Products Table (Campos según Challenge 2.2, manteniendo datos del Excel)
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    price_100_u DECIMAL(10, 2),
    stock INTEGER DEFAULT 0,
    size TEXT,
    color TEXT,
    available TEXT,
    category TEXT,
    price_50_u DECIMAL(10, 2),
    price_200_u DECIMAL(10, 2)
);

-- Carts Table (un carrito por conversación, usa conversation_id de Laburen)
CREATE TABLE IF NOT EXISTS carts (
    id TEXT PRIMARY KEY, -- conversation_id de Laburen/Chatwoot
    chatwoot_conversation_id INTEGER,
    total DECIMAL(12, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cart Items Table
CREATE TABLE IF NOT EXISTS cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    cart_id TEXT REFERENCES carts (id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products (id),
    qty INTEGER NOT NULL CHECK (qty > 0),
    price DECIMAL(10, 2) NOT NULL, -- Precio unitario al momento de agregar
    UNIQUE (cart_id, product_id)
);