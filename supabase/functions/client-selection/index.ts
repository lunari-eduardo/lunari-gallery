import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';
import { syncSessionOnFinalize } from '../_shared/session-sync.ts';

// Handshake com gallery-create-payment — deve bater com GCP_VERSION lá.
const EXPECTED_GCP_VERSION = 'v2.2.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiter — in-memory per isolate (burst protection)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60; // max requests per window
const RATE_WINDOW = 60_000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

interface RequestBody {
  galleryToken: string;
  photoId?: string;
  action: 'toggle' | 'select' | 'deselect' | 'comment' | 'favorite' | 'finalize_payment' | 'regenerate_charge';
  comment?: string;
  visitorId?: string;  // Required for public galleries
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Rate limit check
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(clientIp)) {
      return new Response(
        JSON.stringify({ error: 'Muitas requisições. Tente novamente em instantes.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: RequestBody = await req.json();
    const { galleryToken, photoId, action, comment, visitorId } = body;

    // Validate required fields
    if (!action) {
      return new Response(
        JSON.stringify({ error: 'action é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!galleryToken) {
      return new Response(
        JSON.stringify({ error: 'galleryToken é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve galleryId from token (primary) or alias (fallback)
    let tokenGallery: { id: string } | null = null;
    const { data: primaryGallery, error: tokenError } = await supabase
      .from('galerias')
      .select('id')
      .eq('public_token', galleryToken)
      .single();

    if (!tokenError && primaryGallery) {
      tokenGallery = primaryGallery;
    } else {
      // Fallback: check token aliases for old/rotated tokens
      const { data: alias } = await supabase
        .from('gallery_token_aliases')
        .select('gallery_id')
        .eq('old_token', galleryToken)
        .single();
      if (alias?.gallery_id) {
        tokenGallery = { id: alias.gallery_id };
        console.log(`[client-selection] Resolved via token alias: ${galleryToken} -> ${alias.gallery_id}`);
      }
    }

    if (!tokenGallery) {
      return new Response(
        JSON.stringify({ error: 'Galeria não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const galleryId = tokenGallery.id;

    // Handle finalize_payment action (PIX Manual confirmation by client)
    if (action === 'finalize_payment') {
      const { data: gallery, error: galleryError } = await supabase
        .from('galerias')
        .select('id, status_selecao, session_id')
        .eq('id', galleryId)
        .single();

      if (galleryError || !gallery) {
        return new Response(
          JSON.stringify({ error: 'Galeria não encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (gallery.status_selecao !== 'aguardando_pagamento') {
        return new Response(
          JSON.stringify({ error: 'Esta galeria não está aguardando pagamento' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Finalize the gallery
      const now = new Date().toISOString();
      await supabase
        .from('galerias')
        .update({
          status_selecao: 'selecao_completa',
          finalized_at: now,
          status_pagamento: 'aguardando_confirmacao',
          updated_at: now,
        })
        .eq('id', galleryId);

      // Sincronização Sessão via edge do Gestão (contrato 2026-07-11).
      // Escrita direta em `clientes_sessoes` foi removida — a edge é o único canal.
      if (gallery.session_id) {
        await syncSessionOnFinalize({
          supabase,
          galleryId,
          sessionId: gallery.session_id,
        });
      }

      // Log action
      await supabase.from('galeria_acoes').insert({
        galeria_id: galleryId,
        tipo: 'pagamento_informado',
        descricao: 'Cliente informou pagamento PIX manual',
        user_id: null,
      });

      return new Response(
        JSON.stringify({ success: true, message: 'Pagamento informado com sucesso' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle regenerate_charge: cliente pede novo link quando cobrança expirou/foi cancelada.
    // Fluxo: RPC prepara o estado → chama gallery-create-payment para criar cobrança real
    // e devolver checkoutUrl/asaasCheckoutData/pixDados para o front rotear.
    if (action === 'regenerate_charge') {
      try {
        console.log('[regenerate_charge][step:1] rpc regenerate_pending_charge', { galleryId });
        const { data: rpcData, error: rpcError } = await supabase.rpc('regenerate_pending_charge', { p_gallery_id: galleryId });
        if (rpcError) throw rpcError;

        const provedor = (rpcData as any)?.provedor || null;
        const valorACobrar = Number((rpcData as any)?.calc?.valor_a_cobrar || 0);
        const isFullyPaid = (rpcData as any)?.calc?.is_fully_paid === true;

        console.log('[regenerate_charge][step:2] rpc-ok', { provedor, valorACobrar, isFullyPaid });

        // Sem saldo → devolve NO_AMOUNT_DUE (front trata como pagamento já concluído)
        if (valorACobrar <= 0 || isFullyPaid) {
          return new Response(
            JSON.stringify({
              success: true,
              code: 'NO_AMOUNT_DUE',
              data: { ...rpcData, charge: { success: true, code: 'NO_AMOUNT_DUE', alreadyPaid: true } },
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Chama gallery-create-payment via fetch com service role (padrão do projeto)
        const supabaseUrlEnv = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const gcpUrl = `${supabaseUrlEnv}/functions/v1/gallery-create-payment`;

        console.log('[regenerate_charge][step:3] calling gallery-create-payment', { provedor });

        const gcpAc = new AbortController();
        const gcpTimer = setTimeout(() => gcpAc.abort(), 25_000);
        let gcpResp: Response;
        try {
          gcpResp = await fetch(gcpUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
              'apikey': serviceKey,
            },
            body: JSON.stringify({
              galleryId,
              provider: provedor || undefined,
              descricao: 'Regeneração via cliente',
              expectedVersion: EXPECTED_GCP_VERSION,
            }),
            signal: gcpAc.signal,
          });
        } catch (fetchErr: any) {
          clearTimeout(gcpTimer);
          const aborted = fetchErr?.name === 'AbortError';
          console.error('[regenerate_charge][step:3 fetch-error]', fetchErr?.message || fetchErr);
          return new Response(
            JSON.stringify({
              success: false,
              error: aborted ? 'Gateway não respondeu a tempo' : 'Falha ao contatar o gateway de pagamento',
              code: aborted ? 'GATEWAY_TIMEOUT' : 'GATEWAY_UNREACHABLE',
            }),
            { status: aborted ? 504 : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } finally {
          clearTimeout(gcpTimer);
        }

        let charge = await gcpResp.json().catch(() => ({} as any));

        // ── Handshake de versão ──
        const gotGcpVersion = charge?.version || gcpResp.headers.get('x-gcp-version') || 'unknown';
        if (gotGcpVersion !== EXPECTED_GCP_VERSION) {
          console.warn(`⚠️ PIPELINE_VERSION_DRIFT expected=${EXPECTED_GCP_VERSION} got=${gotGcpVersion}`);
        }

        // ── Shim de compatibilidade com build legada do gcp ──
        if (gcpResp.status === 400 && /clienteid/i.test(String(charge?.error ?? ''))) {
          console.warn('⚠️ GCP_LEGACY_FALLBACK — build antiga detectada, repetindo com payload legado');
          const { data: legacyGallery } = await supabase
            .from('galerias')
            .select('cliente_id, session_id, nome_sessao')
            .eq('id', galleryId)
            .maybeSingle();

          gcpResp = await fetch(gcpUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
              'apikey': serviceKey,
            },
            body: JSON.stringify({
              galleryId,
              provider: provedor || undefined,
              descricao: 'Regeneração via cliente',
              expectedVersion: EXPECTED_GCP_VERSION,
              clienteId: legacyGallery?.cliente_id || null,
              sessionId: legacyGallery?.session_id || null,
              valorTotal: valorACobrar,
            }),
          });
          charge = await gcpResp.json().catch(() => ({} as any));
        }

        if (!gcpResp.ok || !charge?.success) {
          console.error('[regenerate_charge][step:4 upstream-error]', gcpResp.status, charge);
          return new Response(
            JSON.stringify({
              success: false,
              error: charge?.error || 'Não foi possível gerar o link de pagamento',
              code: charge?.code || 'PAYMENT_CREATE_ERROR',
            }),
            { status: gcpResp.status || 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('[regenerate_charge][step:5] charge-ok', {
          provedor: charge.provedor,
          hasCheckoutUrl: !!charge.checkoutUrl,
          transparentCheckout: !!charge.transparentCheckout,
        });

        try {
          await supabase.from('galeria_acoes').insert({
            galeria_id: galleryId,
            tipo: 'pagamento_regenerado',
            descricao: 'Cliente solicitou regeneração do link de pagamento',
            user_id: null,
            payload: { via: 'client-selection', provedor: charge.provedor, cobrancaId: charge.cobrancaId ?? null },
          });
        } catch (_logErr) { /* não crítico */ }

        return new Response(
          JSON.stringify({ success: true, data: { ...rpcData, charge } }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (e) {
        console.error('[regenerate_charge][fatal]', e);
        return new Response(
          JSON.stringify({ error: e instanceof Error ? e.message : 'Falha ao regenerar cobrança' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }


    // For photo actions, photoId is required
    if (!photoId) {
      return new Response(
        JSON.stringify({ error: 'photoId é obrigatório para esta ação' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Fetch gallery to validate status
    const { data: gallery, error: galleryError } = await supabase
      .from('galerias')
      .select('id, status, status_selecao, prazo_selecao, finalized_at, session_id, permissao')
      .eq('id', galleryId)
      .single();

    if (galleryError || !gallery) {
      return new Response(
        JSON.stringify({ error: 'Galeria não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Validate gallery is in allowed status
    const allowedStatuses = ['enviado', 'selecao_iniciada', 'selecao_completa'];
    if (!allowedStatuses.includes(gallery.status)) {
      return new Response(
        JSON.stringify({ error: 'Esta galeria não está aberta para seleção' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2.5. Check if gallery is expired
    if (gallery.status === 'expirado' || 
        (gallery.prazo_selecao && new Date(gallery.prazo_selecao) < new Date())) {
      return new Response(
        JSON.stringify({ error: 'O prazo desta galeria expirou' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. For PUBLIC galleries with visitor, check visitor-level finalization instead
    const isPublicGallery = gallery.permissao === 'public';
    
    if (!isPublicGallery) {
      // PRIVATE gallery: original check
      if (gallery.status_selecao === 'selecao_completa' || gallery.finalized_at) {
        return new Response(
          JSON.stringify({ error: 'A seleção desta galeria já foi confirmada' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (visitorId) {
      // PUBLIC gallery: check visitor's own status
      const { data: visitor } = await supabase
        .from('galeria_visitantes')
        .select('status')
        .eq('id', visitorId)
        .eq('galeria_id', galleryId)
        .single();
      if (visitor?.status === 'finalizado') {
        return new Response(
          JSON.stringify({ error: 'Sua seleção já foi confirmada' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 4. Check if deadline has passed
    if (gallery.prazo_selecao) {
      const deadline = new Date(gallery.prazo_selecao);
      if (deadline < new Date()) {
        return new Response(
          JSON.stringify({ error: 'O prazo de seleção expirou' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 5. Verify photo exists in gallery
    const { data: photo, error: photoError } = await supabase
      .from('galeria_fotos')
      .select('id, is_selected, is_favorite, comment')
      .eq('id', photoId)
      .eq('galeria_id', galleryId)
      .single();

    if (photoError || !photo) {
      return new Response(
        JSON.stringify({ error: 'Foto não encontrada nesta galeria' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── PUBLIC GALLERY: Use visitante_selecoes ──
    if (isPublicGallery && visitorId) {
      // Get current visitor selection for this photo
      const { data: existingSel } = await supabase
        .from('visitante_selecoes')
        .select('is_selected, is_favorite, comment')
        .eq('visitante_id', visitorId)
        .eq('foto_id', photoId)
        .maybeSingle();

      const currentSel = existingSel || { is_selected: false, is_favorite: false, comment: null };

      let upsertData: { is_selected?: boolean; is_favorite?: boolean; comment?: string } = {};

      switch (action) {
        case 'toggle': upsertData.is_selected = !currentSel.is_selected; break;
        case 'select': upsertData.is_selected = true; break;
        case 'deselect': upsertData.is_selected = false; break;
        case 'comment': upsertData.comment = comment || ''; break;
        case 'favorite': upsertData.is_favorite = !currentSel.is_favorite; break;
        default:
          return new Response(JSON.stringify({ error: 'Ação inválida' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { error: upsertError } = await supabase
        .from('visitante_selecoes')
        .upsert({
          visitante_id: visitorId,
          foto_id: photoId,
          is_selected: upsertData.is_selected ?? currentSel.is_selected,
          is_favorite: upsertData.is_favorite ?? currentSel.is_favorite,
          comment: upsertData.comment ?? currentSel.comment,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'visitante_id,foto_id' });

      if (upsertError) {
        console.error('Visitor selection upsert error:', upsertError);
        return new Response(JSON.stringify({ error: 'Erro ao atualizar seleção' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Update gallery status to selecao_iniciada if needed
      if (gallery.status === 'enviado') {
        await supabase.from('galerias')
          .update({ status: 'selecao_iniciada', updated_at: new Date().toISOString() })
          .eq('id', galleryId);
      }

      return new Response(
        JSON.stringify({
          success: true,
          photo: {
            id: photoId,
            is_selected: upsertData.is_selected ?? currentSel.is_selected,
            is_favorite: upsertData.is_favorite ?? currentSel.is_favorite,
            comment: upsertData.comment ?? currentSel.comment,
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── PRIVATE GALLERY: Original flow ──
    // 6. Prepare update based on action
    let updateData: { is_selected?: boolean; is_favorite?: boolean; comment?: string; updated_at?: string } = {
      updated_at: new Date().toISOString()
    };

    switch (action) {
      case 'toggle':
        updateData.is_selected = !photo.is_selected;
        break;
      case 'select':
        updateData.is_selected = true;
        break;
      case 'deselect':
        updateData.is_selected = false;
        break;
      case 'comment':
        updateData.comment = comment || '';
        break;
      case 'favorite':
        updateData.is_favorite = !photo.is_favorite;
        break;
      default:
        return new Response(
          JSON.stringify({ error: 'Ação inválida' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // 7. Update photo
    const { error: updateError } = await supabase
      .from('galeria_fotos')
      .update(updateData)
      .eq('id', photoId)
      .eq('galeria_id', galleryId);

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar seleção' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Update gallery status to selecao_iniciada if it was just 'enviado'
    if (gallery.status === 'enviado') {
      await supabase
        .from('galerias')
        .update({ status: 'selecao_iniciada', updated_at: new Date().toISOString() })
        .eq('id', galleryId);
      
      await supabase.from('galeria_acoes').insert({
        galeria_id: galleryId,
        tipo: 'selecao_iniciada',
        descricao: 'Cliente iniciou a seleção de fotos',
        user_id: null,
      });
      
      // Escrita em `clientes_sessoes.status_galeria='em_selecao'` removida
      // (contrato Gestão 2026-07-11). O Gestão não depende desse badge
      // intermediário; a trigger sync_gallery_extras_to_session já cobre.
    }

    // 9. Log action
    const actionType = action === 'comment' 
      ? 'comment_added' 
      : action === 'favorite'
        ? (updateData.is_favorite ? 'photo_favorited' : 'photo_unfavorited')
        : (updateData.is_selected ? 'photo_selected' : 'photo_deselected');
    const actionDesc = action === 'comment' 
      ? 'Comentário adicionado à foto' 
      : action === 'favorite'
        ? (updateData.is_favorite ? 'Foto favoritada pelo cliente' : 'Foto desfavoritada pelo cliente')
        : (updateData.is_selected ? 'Foto selecionada pelo cliente' : 'Foto desmarcada pelo cliente');
    
    await supabase.from('galeria_acoes').insert({
      galeria_id: galleryId,
      tipo: actionType,
      descricao: actionDesc,
      user_id: null,
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        photo: {
          id: photoId,
          is_selected: action === 'comment' || action === 'favorite' ? photo.is_selected : updateData.is_selected,
          is_favorite: action === 'favorite' ? updateData.is_favorite : photo.is_favorite,
          comment: action === 'comment' ? updateData.comment : photo.comment,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Client selection error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
