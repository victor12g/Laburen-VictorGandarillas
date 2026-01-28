-- Migration: Agregar campos de reserva a carts
-- Fecha: 2026-01-27
-- Descripción: Agregar status y reserved_at para manejar reservas de 24h con stock

ALTER TABLE carts
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

ALTER TABLE carts
ADD COLUMN IF NOT EXISTS reserved_at TIMESTAMP WITH TIME ZONE;

-- Crear índice para limpiar rápidamente reservas expiradas
CREATE INDEX IF NOT EXISTS idx_carts_status_reserved_at 
ON carts(status, reserved_at) 
WHERE status = 'reserved';
