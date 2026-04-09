
-- =============================================
-- ETAPA 1: Galerias Públicas Multiusuário
-- =============================================

-- 1. Tabela galeria_visitantes
CREATE TABLE public.galeria_visitantes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  galeria_id UUID NOT NULL REFERENCES public.galerias(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  contato TEXT NOT NULL,
  contato_tipo TEXT NOT NULL CHECK (contato_tipo IN ('email', 'whatsapp')),
  device_hash TEXT,
  status TEXT NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'finalizado')),
  status_selecao TEXT NOT NULL DEFAULT 'selecao_iniciada' CHECK (status_selecao IN ('selecao_iniciada', 'selecao_completa', 'aguardando_pagamento')),
  fotos_selecionadas INTEGER NOT NULL DEFAULT 0,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(galeria_id, contato)
);

-- Indexes
CREATE INDEX idx_galeria_visitantes_galeria ON public.galeria_visitantes(galeria_id);
CREATE INDEX idx_galeria_visitantes_device ON public.galeria_visitantes(device_hash) WHERE device_hash IS NOT NULL;

-- RLS
ALTER TABLE public.galeria_visitantes ENABLE ROW LEVEL SECURITY;

-- Fotógrafo vê visitantes das suas galerias
CREATE POLICY "Photographer can view own gallery visitors"
  ON public.galeria_visitantes FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.galerias g
    WHERE g.id = galeria_visitantes.galeria_id AND g.user_id = auth.uid()
  ));

-- Fotógrafo pode atualizar visitantes (marcar como finalizado)
CREATE POLICY "Photographer can update own gallery visitors"
  ON public.galeria_visitantes FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.galerias g
    WHERE g.id = galeria_visitantes.galeria_id AND g.user_id = auth.uid()
  ));

-- 2. Tabela visitante_selecoes
CREATE TABLE public.visitante_selecoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitante_id UUID NOT NULL REFERENCES public.galeria_visitantes(id) ON DELETE CASCADE,
  foto_id UUID NOT NULL REFERENCES public.galeria_fotos(id) ON DELETE CASCADE,
  is_selected BOOLEAN NOT NULL DEFAULT false,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  comment TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(visitante_id, foto_id)
);

-- Indexes
CREATE INDEX idx_visitante_selecoes_visitante ON public.visitante_selecoes(visitante_id);
CREATE INDEX idx_visitante_selecoes_foto ON public.visitante_selecoes(foto_id);

-- RLS
ALTER TABLE public.visitante_selecoes ENABLE ROW LEVEL SECURITY;

-- Fotógrafo pode ver seleções dos visitantes das suas galerias
CREATE POLICY "Photographer can view visitor selections"
  ON public.visitante_selecoes FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.galeria_visitantes gv
    JOIN public.galerias g ON g.id = gv.galeria_id
    WHERE gv.id = visitante_selecoes.visitante_id AND g.user_id = auth.uid()
  ));

-- 3. Adicionar visitor_id em cobrancas
ALTER TABLE public.cobrancas
  ADD COLUMN visitor_id UUID REFERENCES public.galeria_visitantes(id) ON DELETE SET NULL;

CREATE INDEX idx_cobrancas_visitor ON public.cobrancas(visitor_id) WHERE visitor_id IS NOT NULL;

-- 4. Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_visitante_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_galeria_visitantes_updated_at
  BEFORE UPDATE ON public.galeria_visitantes
  FOR EACH ROW EXECUTE FUNCTION public.update_visitante_updated_at();

CREATE TRIGGER trg_visitante_selecoes_updated_at
  BEFORE UPDATE ON public.visitante_selecoes
  FOR EACH ROW EXECUTE FUNCTION public.update_visitante_updated_at();
