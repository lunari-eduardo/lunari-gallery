-- ============================================
-- FASE 1: Expandir tabela galerias
-- ============================================

-- Adicionar novas colunas na tabela galerias
ALTER TABLE public.galerias
ADD COLUMN IF NOT EXISTS permissao TEXT DEFAULT 'private',
ADD COLUMN IF NOT EXISTS nome_sessao TEXT,
ADD COLUMN IF NOT EXISTS nome_pacote TEXT,
ADD COLUMN IF NOT EXISTS mensagem_boas_vindas TEXT,
ADD COLUMN IF NOT EXISTS configuracoes JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS total_fotos INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS fotos_selecionadas INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS valor_extras NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS status_selecao TEXT DEFAULT 'em_andamento',
ADD COLUMN IF NOT EXISTS prazo_selecao TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS enviado_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cliente_nome TEXT,
ADD COLUMN IF NOT EXISTS cliente_email TEXT;

-- Adicionar check constraints
ALTER TABLE public.galerias 
ADD CONSTRAINT galerias_permissao_check 
CHECK (permissao IN ('public', 'private'));

ALTER TABLE public.galerias 
ADD CONSTRAINT galerias_status_selecao_check 
CHECK (status_selecao IN ('em_andamento', 'confirmado', 'bloqueado'));

-- ============================================
-- FASE 2: Criar tabela galeria_fotos
-- ============================================

CREATE TABLE public.galeria_fotos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  galeria_id UUID NOT NULL REFERENCES public.galerias(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Metadados do arquivo
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  
  -- Storage (UNICA versao - chave no B2)
  storage_key TEXT NOT NULL,
  
  -- Selecao do cliente
  is_selected BOOLEAN DEFAULT false,
  comment TEXT,
  order_index INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(galeria_id, storage_key)
);

-- RLS para galeria_fotos
ALTER TABLE public.galeria_fotos ENABLE ROW LEVEL SECURITY;

-- Policy: Usuarios podem gerenciar suas proprias fotos
CREATE POLICY "Users can manage own gallery photos"
ON public.galeria_fotos FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Clientes podem visualizar fotos de galerias enviadas
CREATE POLICY "Clients can view sent gallery photos"
ON public.galeria_fotos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.galerias g
    WHERE g.id = galeria_fotos.galeria_id
    AND g.status IN ('enviado', 'selecao_iniciada', 'selecao_completa')
  )
);

-- Indices para performance
CREATE INDEX idx_galeria_fotos_galeria ON public.galeria_fotos(galeria_id);
CREATE INDEX idx_galeria_fotos_user ON public.galeria_fotos(user_id);
CREATE INDEX idx_galeria_fotos_selected ON public.galeria_fotos(galeria_id, is_selected);
CREATE INDEX idx_galeria_fotos_order ON public.galeria_fotos(galeria_id, order_index);

-- Trigger para updated_at
CREATE TRIGGER update_galeria_fotos_updated_at
BEFORE UPDATE ON public.galeria_fotos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- FASE 3: Criar tabela galeria_acoes (historico)
-- ============================================

CREATE TABLE public.galeria_acoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  galeria_id UUID NOT NULL REFERENCES public.galerias(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  tipo TEXT NOT NULL,
  descricao TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT galeria_acoes_tipo_check CHECK (tipo IN (
    'criada', 'enviada', 'cliente_acessou', 
    'cliente_confirmou', 'selecao_reaberta', 'expirada'
  ))
);

-- RLS para galeria_acoes
ALTER TABLE public.galeria_acoes ENABLE ROW LEVEL SECURITY;

-- Policy: Usuarios podem gerenciar suas proprias acoes
CREATE POLICY "Users can manage own gallery actions"
ON public.galeria_acoes FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Indice para busca por galeria
CREATE INDEX idx_galeria_acoes_galeria ON public.galeria_acoes(galeria_id);
CREATE INDEX idx_galeria_acoes_created ON public.galeria_acoes(galeria_id, created_at DESC);

-- ============================================
-- FASE 4: Trigger para atualizar contadores
-- ============================================

CREATE OR REPLACE FUNCTION public.update_galeria_photo_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Atualizar contadores na galeria
  IF TG_OP = 'INSERT' OR TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    UPDATE public.galerias
    SET 
      total_fotos = (
        SELECT COUNT(*) FROM public.galeria_fotos 
        WHERE galeria_id = COALESCE(NEW.galeria_id, OLD.galeria_id)
      ),
      fotos_selecionadas = (
        SELECT COUNT(*) FROM public.galeria_fotos 
        WHERE galeria_id = COALESCE(NEW.galeria_id, OLD.galeria_id) 
        AND is_selected = true
      ),
      updated_at = now()
    WHERE id = COALESCE(NEW.galeria_id, OLD.galeria_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_update_galeria_counts
AFTER INSERT OR UPDATE OR DELETE ON public.galeria_fotos
FOR EACH ROW
EXECUTE FUNCTION public.update_galeria_photo_counts();