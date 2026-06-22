
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    const publicToken = body.publicToken || body.token
    const password = body.password
    const visitorId = body.visitorId

    // 1. Fetch gallery with photographer's global settings
    console.log(`Fetching gallery with token: ${publicToken}`)
    const { data: gallery, error: galleryError } = await supabase
      .from('galerias')
      .select('*')
      .eq('public_token', publicToken)
      .maybeSingle()

    if (galleryError) {
      console.error('Database error fetching gallery:', galleryError)
      return new Response(JSON.stringify({ 
        error: 'Database error', 
        details: galleryError,
        code: 'INTERNAL_ERROR'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!gallery) {
      console.warn(`Gallery not found for token: ${publicToken}`)
      return new Response(JSON.stringify({ 
        error: 'Gallery not found',
        code: 'NOT_FOUND' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Pre-fetch studio settings (detailed)
    const { data: settings } = await supabase
      .from('gallery_settings')
      .select('*')
      .eq('user_id', gallery.user_id)
      .maybeSingle()

    // Resolve owner settings (account theme)
    const accountTheme = settings;

    // 3. Check password if private
    if (gallery.permissao === 'private' && gallery.gallery_password !== password) {
      return new Response(JSON.stringify({ 
        success: true,
        requiresPassword: true,
        sessionName: gallery.nome_sessao,
        studioSettings: settings,
        error: password ? 'Senha incorreta' : undefined,
        code: password ? 'WRONG_PASSWORD' : 'AUTH_REQUIRED'
      }), {
        status: password ? 401 : 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Fetch related data
    const [
      { data: photos },
      { data: folders },
    ] = await Promise.all([
      // Ordem canônica: alfabética pelo nome original (estável + id como desempate).
      // Frontend ainda aplica natural sort por causa de "(10)" vs "(2)".
      supabase
        .from('galeria_fotos')
        .select('*')
        .eq('galeria_id', gallery.id)
        .order('original_filename', { ascending: true })
        .order('id', { ascending: true }),
      supabase.from('galeria_pastas').select('*').eq('galeria_id', gallery.id).order('ordem'),
    ])

    // 3.1. CHECK FOR PENDING PAYMENT (Server-side Gating)
    let pendingPaymentData = null;
    let currentSelectionStatus = gallery.status_selecao;
    let visitorSelectionStatus = null;

    if (visitorId) {
      const { data: visitor } = await supabase
        .from('galeria_visitantes')
        .select('status_selecao')
        .eq('id', visitorId)
        .maybeSingle();
      visitorSelectionStatus = visitor?.status_selecao;
    }

    const isAwaitingPayment = currentSelectionStatus === 'aguardando_pagamento' || visitorSelectionStatus === 'aguardando_pagamento';
    const isFinalized = currentSelectionStatus === 'selecao_completa' || visitorSelectionStatus === 'selecao_completa';

    if (isAwaitingPayment) {
      const { data: charges } = await supabase
        .from('cobrancas')
        .select('status')
        .eq('galeria_id', gallery.id);
      
      const hasPending = charges?.some(c => ['pendente', 'aguardando_confirmacao'].includes(c.status));
      const hasPaid = charges?.some(c => ['pago', 'pago_manual'].includes(c.status));

      if (hasPaid && !hasPending) {
         if (visitorId) {
           await supabase.from('galeria_visitantes').update({ status_selecao: 'selecao_completa' }).eq('id', visitorId);
           visitorSelectionStatus = 'selecao_completa';
         } else {
           await supabase.from('galerias').update({ status_selecao: 'selecao_completa' }).eq('id', gallery.id);
           currentSelectionStatus = 'selecao_completa';
         }
      }
    }

    if (isAwaitingPayment && !pendingPaymentData) {
      const { data: cobranca } = await supabase
        .from('cobrancas')
        .select('*')
        .eq('galeria_id', gallery.id)
        .in('status', ['pendente', 'aguardando_confirmacao'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cobranca) {
        pendingPaymentData = {
          pendingPayment: true,
          paymentMethod: cobranca.provedor,
          checkoutUrl: cobranca.ip_checkout_url,
          cobrancaId: cobranca.id,
          valorTotal: cobranca.valor,
          pixDados: (gallery.configuracoes as any)?.pixDados,
        };
      }
    }

    // Filter photos if finalized
    let filteredPhotos = photos || [];
    if (isFinalized) {
      if (visitorId && gallery.permissao === 'public') {
        const { data: visitorSelections } = await supabase
          .from('visitante_selecoes')
          .select('foto_id')
          .eq('visitante_id', visitorId)
          .eq('is_selected', true);
        
        const selectedIds = new Set(visitorSelections?.map(s => s.foto_id) || []);
        filteredPhotos = filteredPhotos.filter(p => selectedIds.has(p.id));
      } else {
        filteredPhotos = filteredPhotos.filter(p => p.is_selected);
      }
    }

    // 4. Resolve Theme (Centralized logic)
    const galleryConfig = gallery.configuracoes as any || {}
    const themeId = (gallery.use_custom_theme ? gallery.theme_id : accountTheme?.default_theme_id) || galleryConfig?.themeId || 'lunari';
    const clientMode = (galleryConfig?.clientMode as 'light' | 'dark') || 'light'
    const themeOverrides = (gallery.use_custom_theme ? gallery.theme_overrides : accountTheme?.theme_overrides) || galleryConfig?.themeOverrides || {};

    let themeData = null
    if (themeId) {
      const { data: theme } = await supabase
        .from('gallery_themes')
        .select('*')
        .eq('id', themeId)
        .maybeSingle()
      if (theme) {
        themeData = {
          id: theme.id,
          name: theme.name,
          backgroundMode: clientMode,
          primaryColor: theme.primary_color,
          accentColor: theme.accent_color,
          emphasisColor: theme.emphasis_color,
        }
      }
    }

    if (!themeData) {
      themeData = { id: 'system', name: 'Sistema', backgroundMode: clientMode, primaryColor: null, accentColor: null, emphasisColor: null }
    }

    // 6. Response
    return new Response(
      JSON.stringify({
        success: true,
        deliver: gallery.tipo === 'entrega',
        galleryId: gallery.id,
        gallery: {
          id: gallery.id,
          sessionName: gallery.nome_sessao,
          clientName: gallery.cliente_nome,
          clientEmail: gallery.cliente_email,
          packageName: gallery.nome_pacote,
          includedPhotos: gallery.fotos_incluidas,
          extraPhotoPrice: Number(gallery.valor_foto_extra || 0),
          selectionStatus: currentSelectionStatus,
          welcomeMessage: gallery.mensagem_boas_vindas,
          expirationDate: gallery.prazo_selecao,
          publicToken: gallery.public_token,
          settings: {
            sessionFont: galleryConfig?.sessionFont || undefined,
            titleCaseMode: galleryConfig?.titleCaseMode || 'normal',
            coverPhotoId: galleryConfig?.coverPhotoId || undefined,
            photoSpacing: galleryConfig?.photoSpacing || undefined,
            themeId: themeId,
            useCustomTheme: gallery.use_custom_theme ?? false,
            themeOverrides: themeOverrides,
            // Capa (apenas Galeria de Entrega): override por galeria + default do fotógrafo
            coverId: (gallery as any).cover_id ?? null,
            defaultCoverId: (settings as any)?.default_cover_id ?? 'fullscreen',
          },
        },
        photos: filteredPhotos,
        finalized: isFinalized,
        folders: folders || [],
        studioSettings: settings || null,
        theme: themeData,
        clientMode,
        accountTheme, // New field for account heritage info
        ...pendingPaymentData,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
