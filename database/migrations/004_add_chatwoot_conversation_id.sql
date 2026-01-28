-- Migration: Agregar chatwoot_conversation_id a carts
-- Fecha: 2026-01-27
-- Descripción: Vincular carrito con conversación en Chatwoot para derivación de agentes

ALTER TABLE carts
ADD COLUMN IF NOT EXISTS chatwoot_conversation_id INTEGER;
