-- Add cliente_telefone column to galerias table
ALTER TABLE public.galerias ADD COLUMN IF NOT EXISTS cliente_telefone TEXT;