-- Função para atualizar contadores do cliente automaticamente
CREATE OR REPLACE FUNCTION update_client_gallery_stats()
RETURNS TRIGGER AS $$
DECLARE
  target_client_id UUID;
BEGIN
  -- Determinar qual cliente atualizar
  IF TG_OP = 'DELETE' THEN
    target_client_id := OLD.cliente_id;
  ELSE
    target_client_id := NEW.cliente_id;
  END IF;
  
  -- Sair se não há cliente associado
  IF target_client_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Atualizar contadores e status do cliente
  UPDATE clientes SET
    total_galerias = (
      SELECT COUNT(*) FROM galerias 
      WHERE cliente_id = target_client_id
    ),
    gallery_status = CASE 
      WHEN EXISTS (
        SELECT 1 FROM galerias 
        WHERE cliente_id = target_client_id 
        AND status NOT IN ('cancelled')
      ) THEN 'ativo' 
      ELSE 'sem_galeria' 
    END,
    updated_at = NOW()
  WHERE id = target_client_id;
  
  -- Também atualizar cliente antigo em caso de UPDATE que muda o cliente
  IF TG_OP = 'UPDATE' AND OLD.cliente_id IS DISTINCT FROM NEW.cliente_id AND OLD.cliente_id IS NOT NULL THEN
    UPDATE clientes SET
      total_galerias = (
        SELECT COUNT(*) FROM galerias 
        WHERE cliente_id = OLD.cliente_id
      ),
      gallery_status = CASE 
        WHEN EXISTS (
          SELECT 1 FROM galerias 
          WHERE cliente_id = OLD.cliente_id 
          AND status NOT IN ('cancelled')
        ) THEN 'ativo' 
        ELSE 'sem_galeria' 
      END,
      updated_at = NOW()
    WHERE id = OLD.cliente_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger na tabela galerias
DROP TRIGGER IF EXISTS trigger_update_client_stats ON galerias;
CREATE TRIGGER trigger_update_client_stats
AFTER INSERT OR UPDATE OF cliente_id, status OR DELETE
ON galerias
FOR EACH ROW
EXECUTE FUNCTION update_client_gallery_stats();

-- Atualizar todos os clientes existentes para refletir dados corretos
UPDATE clientes c SET
  total_galerias = COALESCE((
    SELECT COUNT(*) FROM galerias g 
    WHERE g.cliente_id = c.id
  ), 0),
  gallery_status = CASE 
    WHEN EXISTS (
      SELECT 1 FROM galerias g 
      WHERE g.cliente_id = c.id 
      AND g.status NOT IN ('cancelled')
    ) THEN 'ativo' 
    ELSE 'sem_galeria' 
  END;