-- Allow cliente_id to be NULL in cobrancas table
-- This enables payments for public galleries (galleries without linked clients)
-- The relationship is maintained via galeria_id instead

ALTER TABLE cobrancas ALTER COLUMN cliente_id DROP NOT NULL;

-- Add a comment explaining the change
COMMENT ON COLUMN cobrancas.cliente_id IS 'Optional client reference. NULL for public galleries - use galeria_id for linking instead.';