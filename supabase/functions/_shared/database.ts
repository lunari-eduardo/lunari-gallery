// supabase/functions/_shared/database.ts

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';
import { Gallery } from './types.ts';

/**
 * Encapsula a recuperação dos dados da galeria com tratamento de erros.
 */
export async function getGalleryById(supabase: SupabaseClient, galleryId: string): Promise<{ data: Gallery | null; error: any }> {
  const { data, error } = await supabase
    .from('galerias')
    .select(`
      id, user_id, status, status_selecao, fotos_incluidas, valor_foto_extra, 
      configuracoes, regras_congeladas, total_fotos_extras_vendidas, 
      valor_total_vendido, session_id, public_token, 
      venda_modo, venda_pagamento_provedor, venda_tipo_cobranca
    `)
    .eq('id', galleryId)
    .single();

  return { data: data as Gallery | null, error };
}

/**
 * Busca galeria por token público, incluindo aliases.
 */
export async function resolveGalleryByToken(supabase: SupabaseClient, token: string): Promise<{ id: string | null; error: any }> {
  const { data: primary, error: primaryError } = await supabase
    .from('galerias')
    .select('id')
    .eq('public_token', token)
    .maybeSingle();

  if (primary) return { id: primary.id, error: null };

  const { data: alias, error: aliasError } = await supabase
    .from('gallery_token_aliases')
    .select('gallery_id')
    .eq('old_token', token)
    .maybeSingle();

  return { id: alias?.gallery_id || null, error: aliasError };
}
