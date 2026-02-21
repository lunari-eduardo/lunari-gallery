-- Fix the stuck gallery
UPDATE galerias SET status = 'expirado', updated_at = NOW()
WHERE session_id = 'workflow-1771555514317-0gdkcymsiau' AND status = 'enviado';