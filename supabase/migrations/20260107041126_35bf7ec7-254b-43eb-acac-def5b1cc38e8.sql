-- =============================================
-- 1. Criar tabela gallery_clientes para usuários sem plano Pro + Gallery
-- =============================================
CREATE TABLE public.gallery_clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  
  -- Dados básicos
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  
  -- Senha de acesso às galerias
  gallery_password TEXT NOT NULL,
  
  -- Status e histórico
  status TEXT NOT NULL DEFAULT 'sem_galeria' CHECK (status IN ('ativo', 'sem_galeria')),
  total_galerias INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint: email único por user_id
  UNIQUE(user_id, email)
);

-- RLS Policies para gallery_clientes
ALTER TABLE public.gallery_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own gallery clients"
ON public.gallery_clientes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own gallery clients"
ON public.gallery_clientes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gallery clients"
ON public.gallery_clientes FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own gallery clients"
ON public.gallery_clientes FOR DELETE
USING (auth.uid() = user_id);

-- Índices para gallery_clientes
CREATE INDEX idx_gallery_clientes_user_id ON public.gallery_clientes(user_id);
CREATE INDEX idx_gallery_clientes_email ON public.gallery_clientes(user_id, email);

-- Trigger para updated_at
CREATE TRIGGER update_gallery_clientes_updated_at
  BEFORE UPDATE ON public.gallery_clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 2. Adicionar colunas à tabela clientes existente
-- (para usuários Pro + Gallery)
-- =============================================
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS gallery_password TEXT;

ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS gallery_status TEXT DEFAULT 'sem_galeria';

ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS total_galerias INTEGER DEFAULT 0;

-- Adicionar constraint de check para gallery_status (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'clientes_gallery_status_check'
  ) THEN
    ALTER TABLE public.clientes 
    ADD CONSTRAINT clientes_gallery_status_check 
    CHECK (gallery_status IS NULL OR gallery_status IN ('ativo', 'sem_galeria'));
  END IF;
END $$;