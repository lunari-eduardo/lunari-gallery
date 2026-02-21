-- Fix trigger to handle 'expirado' (the actual value used in galerias.status)
CREATE OR REPLACE FUNCTION public.sync_gallery_status_to_session()
RETURNS TRIGGER AS $$
DECLARE
  session_record RECORD;
  target_status TEXT;
BEGIN
  -- Buscar sessão vinculada pela galeria_id
  SELECT id, status INTO session_record
  FROM public.clientes_sessoes
  WHERE galeria_id = NEW.id
  LIMIT 1;

  -- Fallback: buscar por session_id
  IF session_record.id IS NULL AND NEW.session_id IS NOT NULL THEN
    SELECT id, status INTO session_record
    FROM public.clientes_sessoes
    WHERE session_id = NEW.session_id
    LIMIT 1;
  END IF;

  IF session_record.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Map galerias.status to clientes_sessoes.status (display) and status_galeria
  CASE NEW.status
    WHEN 'enviado' THEN target_status := 'Enviado para seleção';
    WHEN 'selecao_iniciada' THEN target_status := 'Enviado para seleção';
    WHEN 'selecao_completa' THEN target_status := 'Seleção finalizada';
    WHEN 'expirado' THEN target_status := 'Expirada';
    WHEN 'expirada' THEN target_status := 'Expirada';
    ELSE target_status := session_record.status;
  END CASE;

  -- Map galerias.status to the valid status_galeria values
  UPDATE public.clientes_sessoes
  SET status = target_status,
      status_galeria = CASE NEW.status
        WHEN 'expirado' THEN 'expirada'
        ELSE NEW.status
      END,
      status_pagamento_fotos_extra = COALESCE(NEW.status_pagamento, 'sem_vendas'),
      updated_at = NOW()
  WHERE id = session_record.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;