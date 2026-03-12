import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Rate limiter — in-memory per isolate
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30; // max requests per window
const RATE_WINDOW = 60_000;

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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, password } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role for unrestricted access
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Find gallery by public_token
    const { data: gallery, error: galleryError } = await supabase
      .from("galerias")
      .select("id, user_id, tipo, status, status_selecao, status_pagamento, permissao, gallery_password, public_token, session_id, cliente_id, cliente_nome, cliente_email, cliente_telefone, nome_sessao, nome_pacote, mensagem_boas_vindas, fotos_incluidas, fotos_selecionadas, total_fotos, total_fotos_extras_vendidas, valor_foto_extra, valor_extras, valor_total_vendido, prazo_selecao, prazo_selecao_dias, configuracoes, regras_congeladas, regras_selecao, finalized_at, enviado_em, origin, orcamento_id, created_at, updated_at, published_at")
      .eq("public_token", token)
      .single();

    if (galleryError || !gallery) {
      return new Response(
        JSON.stringify({ error: "Galeria não encontrada", code: "NOT_FOUND" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Check if gallery is a DELIVER type (completely different product)
    if (gallery.tipo === 'entrega') {
      // Password check for private deliver galleries
      if (gallery.permissao === 'private' && gallery.gallery_password) {
        if (!password) {
          const galleryConfig = gallery.configuracoes as Record<string, unknown> | null;
          const clientMode = (galleryConfig?.clientMode as 'light' | 'dark') || 'light';
          return new Response(
            JSON.stringify({ 
              requiresPassword: true,
              galleryId: gallery.id,
              sessionName: gallery.nome_sessao,
              clientMode,
              settings: {
                sessionFont: galleryConfig?.sessionFont || undefined,
                titleCaseMode: galleryConfig?.titleCaseMode || 'normal',
              },
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (password !== gallery.gallery_password) {
          return new Response(
            JSON.stringify({ error: "Senha incorreta", code: "WRONG_PASSWORD" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Check expiration
      if (gallery.prazo_selecao && new Date(gallery.prazo_selecao) < new Date()) {
        return new Response(
          JSON.stringify({ error: "Galeria expirada", code: "EXPIRED" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch photos
      const { data: photos } = await supabase
        .from("galeria_fotos")
        .select("id, storage_key, original_path, original_filename, filename, width, height, preview_path, thumb_path, pasta_id")
        .eq("galeria_id", gallery.id)
        .order("original_filename", { ascending: true });

      // Fetch folders
      const { data: folders } = await supabase
        .from("galeria_pastas")
        .select("id, nome, ordem, cover_photo_id")
        .eq("galeria_id", gallery.id)
        .order("ordem");

      // Fetch studio settings
      const { data: settings } = await supabase
        .from("gallery_settings")
        .select("studio_name, studio_logo_url, favicon_url")
        .eq("user_id", gallery.user_id)
        .single();

      // Build theme
      const galleryConfig = gallery.configuracoes as Record<string, unknown> | null;
      const themeId = galleryConfig?.themeId as string | undefined;
      const clientMode = (galleryConfig?.clientMode as 'light' | 'dark') || 'light';
      
      let themeData = null;
      if (themeId) {
        const { data: theme } = await supabase
          .from("gallery_themes")
          .select("*")
          .eq("id", themeId)
          .maybeSingle();
        if (theme) {
          themeData = {
            id: theme.id, name: theme.name,
            backgroundMode: theme.background_mode || 'light',
            primaryColor: theme.primary_color, accentColor: theme.accent_color,
            emphasisColor: theme.emphasis_color,
          };
        }
      }
      if (!themeData) {
        themeData = { id: 'system', name: 'Sistema', backgroundMode: clientMode, primaryColor: null, accentColor: null, emphasisColor: null };
      }

      // Log first access
      const { data: existingAccess } = await supabase
        .from('galeria_acoes').select('id')
        .eq('galeria_id', gallery.id).eq('tipo', 'cliente_acessou').maybeSingle();
      if (!existingAccess) {
        await supabase.from('galeria_acoes').insert({
          galeria_id: gallery.id, tipo: 'cliente_acessou',
          descricao: 'Cliente acessou a galeria de entrega', user_id: null,
        });
      }

      console.log("📦 Deliver gallery accessed:", gallery.id);

      return new Response(
        JSON.stringify({
          deliver: true,
          gallery: {
            id: gallery.id,
            sessionName: gallery.nome_sessao,
            clientName: gallery.cliente_nome,
            welcomeMessage: gallery.mensagem_boas_vindas,
            expirationDate: gallery.prazo_selecao,
            settings: {
              sessionFont: galleryConfig?.sessionFont || undefined,
              titleCaseMode: galleryConfig?.titleCaseMode || 'normal',
            },
          },
          photos: photos || [],
          folders: folders || [],
          studioSettings: settings || null,
          theme: themeData,
          clientMode,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3a. Check if gallery is awaiting payment (selection confirmed but payment pending)
    if (gallery.status_selecao === 'aguardando_pagamento') {
      // Fetch studio settings
      const { data: settings } = await supabase
        .from("gallery_settings")
        .select("studio_name, studio_logo_url, favicon_url")
        .eq("user_id", gallery.user_id)
        .single();

      // Build theme data
      const galleryConfig = gallery.configuracoes as Record<string, unknown> | null;
      const themeId = galleryConfig?.themeId as string | undefined;
      const clientMode = (galleryConfig?.clientMode as 'light' | 'dark') || 'light';
      
      let themeData = null;
      if (themeId) {
        const { data: theme } = await supabase
          .from("gallery_themes")
          .select("*")
          .eq("id", themeId)
          .maybeSingle();
        if (theme) {
          themeData = {
            id: theme.id, name: theme.name,
            backgroundMode: theme.background_mode || 'light',
            primaryColor: theme.primary_color, accentColor: theme.accent_color,
            emphasisColor: theme.emphasis_color,
          };
        }
      }
      if (!themeData) {
        themeData = { id: 'system', name: 'Sistema', backgroundMode: clientMode, primaryColor: null, accentColor: null, emphasisColor: null };
      }

      // Determine payment data to return
      const saleSettings = galleryConfig?.saleSettings as Record<string, unknown> | null;
      const paymentMethod = saleSettings?.paymentMethod as string | undefined;
      const pixDados = galleryConfig?.pixDados as Record<string, unknown> | null;

      // For InfinitePay/MercadoPago, find the pending cobranca with checkout URL
      let pendingCheckoutUrl: string | null = null;
      let pendingProvedor: string | null = null;
      let pendingCobrancaId: string | null = null;
      let pendingValor: number | null = null;

      if (paymentMethod !== 'pix_manual') {
        const { data: pendingCobranca } = await supabase
          .from("cobrancas")
          .select("id, ip_checkout_url, mp_payment_link, provedor, valor, status")
          .eq("galeria_id", gallery.id)
          .eq("status", "pendente")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pendingCobranca) {
          pendingCheckoutUrl = pendingCobranca.ip_checkout_url || pendingCobranca.mp_payment_link;
          pendingProvedor = pendingCobranca.provedor;
          pendingCobrancaId = pendingCobranca.id;
          pendingValor = pendingCobranca.valor;
        }
      }

      console.log("⏳ Gallery awaiting payment:", gallery.id, "method:", paymentMethod);

      // For Asaas transparent checkout: return settings so frontend can render inline checkout
      let asaasCheckoutData = null;
      const resolvedMethod = paymentMethod || pendingProvedor || 'pix_manual';
      if (resolvedMethod === 'asaas') {
        const { data: asaasInteg } = await supabase
          .from("usuarios_integracoes")
          .select("dados_extras")
          .eq("user_id", gallery.user_id)
          .eq("provedor", "asaas")
          .eq("status", "ativo")
          .maybeSingle();

        if (asaasInteg?.dados_extras) {
          const s = asaasInteg.dados_extras as Record<string, unknown>;
          // Normalize session_id
          let sessionIdTexto = gallery.session_id;
          if (sessionIdTexto && !sessionIdTexto.startsWith('workflow-') && !sessionIdTexto.startsWith('session_')) {
            const { data: sess } = await supabase
              .from("clientes_sessoes")
              .select("session_id")
              .or(`id.eq.${sessionIdTexto},session_id.eq.${sessionIdTexto}`)
              .maybeSingle();
            sessionIdTexto = sess?.session_id || sessionIdTexto;
          }

          const extrasCount = gallery.fotos_selecionadas ? Math.max(0, (gallery.fotos_selecionadas || 0) - (gallery.fotos_incluidas || 0)) : 0;
          asaasCheckoutData = {
            galeriaId: gallery.id,
            userId: gallery.user_id,
            valorTotal: pendingValor || gallery.valor_extras || 0,
            descricao: `${extrasCount} foto${extrasCount !== 1 ? 's' : ''} extra${extrasCount !== 1 ? 's' : ''} - ${gallery.nome_sessao || 'Galeria'}`,
            qtdFotos: extrasCount,
            clienteId: gallery.cliente_id,
            sessionId: sessionIdTexto,
            galleryToken: gallery.public_token,
            enabledMethods: {
              pix: s.habilitarPix !== false,
              creditCard: s.habilitarCartao !== false,
              boleto: s.habilitarBoleto === true,
            },
            maxParcelas: (s.maxParcelas as number) || 12,
            absorverTaxa: s.absorverTaxa || false,
            taxaAntecipacao: s.taxaAntecipacao || false,
            taxaAntecipacaoPercentual: s.taxaAntecipacaoPercentual,
            taxaAntecipacaoCreditoAvista: s.taxaAntecipacaoCreditoAvista,
            taxaAntecipacaoCreditoParcelado: s.taxaAntecipacaoCreditoParcelado,
            incluirTaxaAntecipacao: s.incluirTaxaAntecipacao ?? true,
          };
        }
      }

      return new Response(
        JSON.stringify({
          pendingPayment: true,
          galleryId: gallery.id,
          sessionName: gallery.nome_sessao,
          paymentMethod: resolvedMethod,
          pixDados: pixDados,
          checkoutUrl: pendingCheckoutUrl,
          cobrancaId: pendingCobrancaId,
          valorTotal: pendingValor || gallery.valor_extras || 0,
          studioSettings: settings || null,
          theme: themeData,
          clientMode,
          asaasCheckoutData,
          settings: {
            sessionFont: galleryConfig?.sessionFont || undefined,
            titleCaseMode: galleryConfig?.titleCaseMode || 'normal',
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3b. AUTO-RECOVERY: If gallery was marked as finalized BUT payment is still pending,
    // treat it as pending payment (not finalized) so the client can complete checkout
    const isFinalized = gallery.status_selecao === 'selecao_completa' || gallery.finalized_at;
    const galleryConfigForRecovery = gallery.configuracoes as Record<string, unknown> | null;
    const saleSettingsForRecovery = galleryConfigForRecovery?.saleSettings as Record<string, unknown> | null;
    const saleModeFinalCheck = saleSettingsForRecovery?.mode as string | undefined;
    const paymentStatusFinalCheck = gallery.status_pagamento;
    
    const needsPaymentRecovery = isFinalized && 
      saleModeFinalCheck === 'sale_with_payment' && 
      (paymentStatusFinalCheck === 'pendente' || paymentStatusFinalCheck === 'aguardando_confirmacao') &&
      !gallery.finalized_at; // Only recover if finalized_at is NOT set (payment was never completed)
    
    if (needsPaymentRecovery) {
      console.log("🔄 AUTO-RECOVERY: Gallery marked as selecao_completa but payment is still pending. Redirecting to payment flow.");
      
      // Re-route to the pending payment handler by overriding status_selecao temporarily
      // We reuse the exact same logic from section 3a (aguardando_pagamento)
      const { data: recoverySettings } = await supabase
        .from("gallery_settings")
        .select("studio_name, studio_logo_url, favicon_url")
        .eq("user_id", gallery.user_id)
        .single();

      const recoveryConfig = gallery.configuracoes as Record<string, unknown> | null;
      const recoveryThemeId = (recoveryConfig?.themeId as string) || undefined;
      const recoveryClientMode = (recoveryConfig?.clientMode as 'light' | 'dark') || 'light';
      
      let recoveryThemeData = null;
      if (recoveryThemeId) {
        const { data: theme } = await supabase
          .from("gallery_themes")
          .select("*")
          .eq("id", recoveryThemeId)
          .maybeSingle();
        if (theme) {
          recoveryThemeData = {
            id: theme.id, name: theme.name,
            backgroundMode: theme.background_mode || 'light',
            primaryColor: theme.primary_color, accentColor: theme.accent_color,
            emphasisColor: theme.emphasis_color,
          };
        }
      }
      if (!recoveryThemeData) {
        recoveryThemeData = { id: 'system', name: 'Sistema', backgroundMode: recoveryClientMode, primaryColor: null, accentColor: null, emphasisColor: null };
      }

      const recoveryPaymentMethod = (saleSettingsForRecovery?.paymentMethod as string) || undefined;
      const recoveryPixDados = recoveryConfig?.pixDados as Record<string, unknown> | null;

      let recoveryCheckoutUrl: string | null = null;
      let recoveryProvedor: string | null = null;
      let recoveryCobrancaId: string | null = null;
      let recoveryValor: number | null = null;

      if (recoveryPaymentMethod !== 'pix_manual') {
        const { data: pendingCobranca } = await supabase
          .from("cobrancas")
          .select("id, ip_checkout_url, mp_payment_link, provedor, valor, status")
          .eq("galeria_id", gallery.id)
          .eq("status", "pendente")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pendingCobranca) {
          recoveryCheckoutUrl = pendingCobranca.ip_checkout_url || pendingCobranca.mp_payment_link;
          recoveryProvedor = pendingCobranca.provedor;
          recoveryCobrancaId = pendingCobranca.id;
          recoveryValor = pendingCobranca.valor;
        }
      }

      // For Asaas transparent checkout
      let recoveryAsaasData = null;
      const resolvedRecoveryMethod = recoveryPaymentMethod || recoveryProvedor || 'pix_manual';
      if (resolvedRecoveryMethod === 'asaas') {
        const { data: asaasInteg } = await supabase
          .from("usuarios_integracoes")
          .select("dados_extras")
          .eq("user_id", gallery.user_id)
          .eq("provedor", "asaas")
          .eq("status", "ativo")
          .maybeSingle();

        if (asaasInteg?.dados_extras) {
          const s = asaasInteg.dados_extras as Record<string, unknown>;
          let sessionIdTexto = gallery.session_id;
          if (sessionIdTexto && !sessionIdTexto.startsWith('workflow-') && !sessionIdTexto.startsWith('session_')) {
            const { data: sess } = await supabase
              .from("clientes_sessoes")
              .select("session_id")
              .or(`id.eq.${sessionIdTexto},session_id.eq.${sessionIdTexto}`)
              .maybeSingle();
            sessionIdTexto = sess?.session_id || sessionIdTexto;
          }

          const extrasCount = gallery.fotos_selecionadas ? Math.max(0, (gallery.fotos_selecionadas || 0) - (gallery.fotos_incluidas || 0)) : 0;
          recoveryAsaasData = {
            galeriaId: gallery.id,
            userId: gallery.user_id,
            valorTotal: recoveryValor || gallery.valor_extras || 0,
            descricao: `${extrasCount} foto${extrasCount !== 1 ? 's' : ''} extra${extrasCount !== 1 ? 's' : ''} - ${gallery.nome_sessao || 'Galeria'}`,
            qtdFotos: extrasCount,
            clienteId: gallery.cliente_id,
            sessionId: sessionIdTexto,
            galleryToken: gallery.public_token,
            enabledMethods: {
              pix: s.habilitarPix !== false,
              creditCard: s.habilitarCartao !== false,
              boleto: s.habilitarBoleto === true,
            },
            maxParcelas: (s.maxParcelas as number) || 12,
            absorverTaxa: s.absorverTaxa || false,
            taxaAntecipacao: s.taxaAntecipacao || false,
            taxaAntecipacaoPercentual: s.taxaAntecipacaoPercentual,
            taxaAntecipacaoCreditoAvista: s.taxaAntecipacaoCreditoAvista,
            taxaAntecipacaoCreditoParcelado: s.taxaAntecipacaoCreditoParcelado,
          };
        }
      }

      // Also fix the gallery status back to aguardando_pagamento for consistency
      await supabase.from('galerias').update({
        status_selecao: 'aguardando_pagamento',
        updated_at: new Date().toISOString(),
      }).eq('id', gallery.id);

      return new Response(
        JSON.stringify({
          pendingPayment: true,
          galleryId: gallery.id,
          sessionName: gallery.nome_sessao,
          paymentMethod: resolvedRecoveryMethod,
          pixDados: recoveryPixDados,
          checkoutUrl: recoveryCheckoutUrl,
          cobrancaId: recoveryCobrancaId,
          valorTotal: recoveryValor || gallery.valor_extras || 0,
          studioSettings: recoverySettings || null,
          theme: recoveryThemeData,
          clientMode: recoveryClientMode,
          asaasCheckoutData: recoveryAsaasData,
          settings: {
            sessionFont: recoveryConfig?.sessionFont || undefined,
            titleCaseMode: recoveryConfig?.titleCaseMode || 'normal',
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (isFinalized) {
      // Fetch studio settings for logo on finalized screen
      const { data: settings } = await supabase
        .from("gallery_settings")
        .select("studio_name, studio_logo_url, favicon_url")
        .eq("user_id", gallery.user_id)
        .single();
      
      // Build theme data for finalized screen
      const galleryConfig = gallery.configuracoes as Record<string, unknown> | null;
      const themeId = galleryConfig?.themeId as string | undefined;
      const clientMode = (galleryConfig?.clientMode as 'light' | 'dark') || 'light';
      const allowDownload = galleryConfig?.allowDownload === true;
      
      let themeData = null;
      if (themeId) {
        const { data: theme } = await supabase
          .from("gallery_themes")
          .select("*")
          .eq("id", themeId)
          .maybeSingle();
        
        if (theme) {
          themeData = {
            id: theme.id,
            name: theme.name,
            backgroundMode: theme.background_mode || 'light',
            primaryColor: theme.primary_color,
            accentColor: theme.accent_color,
            emphasisColor: theme.emphasis_color,
          };
        }
      }
      
      // Use system theme with clientMode if no custom theme
      if (!themeData) {
        themeData = {
          id: 'system',
          name: 'Sistema',
          backgroundMode: clientMode,
          primaryColor: null,
          accentColor: null,
          emphasisColor: null,
        };
      }
      
      // ALWAYS fetch selected photos for preview (regardless of download permission)
      const { data: selectedPhotos } = await supabase
        .from("galeria_fotos")
        .select("id, storage_key, original_path, original_filename, filename")
        .eq("galeria_id", gallery.id)
        .eq("is_selected", true)
        .order("original_filename", { ascending: true });
      
      console.log("🔒 Gallery finalized - returning selected photos for preview, allowDownload:", allowDownload);
      
      return new Response(
        JSON.stringify({ 
          finalized: true,
          galleryId: gallery.id,
          allowDownload: allowDownload,
          sessionName: gallery.nome_sessao,
          photos: selectedPhotos || [],
          studioSettings: settings || null,
          theme: themeData,
          clientMode: clientMode,
          settings: {
            sessionFont: galleryConfig?.sessionFont || undefined,
            titleCaseMode: galleryConfig?.titleCaseMode || 'normal',
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Check if gallery is in valid status for selection
    const validStatuses = ["enviado", "selecao_iniciada", "expirado"];
    if (!validStatuses.includes(gallery.status)) {
      return new Response(
        JSON.stringify({ error: "Galeria não disponível", code: "NOT_AVAILABLE" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3.5. Check expiration for selection galleries
    const isExpired = gallery.status === 'expirado' || 
      (gallery.prazo_selecao && new Date(gallery.prazo_selecao) < new Date());

    if (isExpired) {
      // Update gallery status to expired if not already
      if (gallery.status !== 'expirado') {
        await supabase.from('galerias').update({ 
          status: 'expirado',
          updated_at: new Date().toISOString()
        }).eq('id', gallery.id);

        // Sync to clientes_sessoes
        if (gallery.session_id) {
          await supabase.from('clientes_sessoes').update({ 
            status_galeria: 'expirada',
            updated_at: new Date().toISOString()
          }).eq('session_id', gallery.session_id);
        }

        // Log expiration event
        const { data: existingExpired } = await supabase
          .from('galeria_acoes').select('id')
          .eq('galeria_id', gallery.id).eq('tipo', 'expirada').maybeSingle();
        if (!existingExpired) {
          await supabase.from('galeria_acoes').insert({
            galeria_id: gallery.id, tipo: 'expirada',
            descricao: 'Prazo da galeria expirou', user_id: null,
          });
        }
      }

      // Fetch studio settings for branding on expiration screen
      const { data: expiredSettings } = await supabase
        .from("gallery_settings")
        .select("studio_name, studio_logo_url, favicon_url")
        .eq("user_id", gallery.user_id)
        .single();

      // Build theme data for expiration screen
      const expiredGalleryConfig = gallery.configuracoes as Record<string, unknown> | null;
      const expiredThemeId = expiredGalleryConfig?.themeId as string | undefined;
      const expiredClientMode = (expiredGalleryConfig?.clientMode as 'light' | 'dark') || 'light';

      let expiredThemeData = null;
      if (expiredThemeId) {
        const { data: expiredTheme } = await supabase
          .from("gallery_themes")
          .select("*")
          .eq("id", expiredThemeId)
          .maybeSingle();
        if (expiredTheme) {
          expiredThemeData = {
            id: expiredTheme.id, name: expiredTheme.name,
            backgroundMode: expiredTheme.background_mode || 'light',
            primaryColor: expiredTheme.primary_color,
            accentColor: expiredTheme.accent_color,
            emphasisColor: expiredTheme.emphasis_color,
          };
        }
      }
      if (!expiredThemeData) {
        expiredThemeData = { id: 'system', name: 'Sistema', backgroundMode: expiredClientMode, primaryColor: null, accentColor: null, emphasisColor: null };
      }

      console.log("⏰ Gallery expired:", gallery.id);

      return new Response(
        JSON.stringify({
          expired: true,
          galleryId: gallery.id,
          sessionName: gallery.nome_sessao,
          studioSettings: expiredSettings || null,
          theme: expiredThemeData,
          clientMode: expiredClientMode,
          settings: {
            sessionFont: expiredGalleryConfig?.sessionFont || undefined,
            titleCaseMode: expiredGalleryConfig?.titleCaseMode || 'normal',
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3.6. Check password for private galleries
    if (gallery.permissao === "private" && gallery.gallery_password) {
    // If no password provided, request it
      if (!password) {
        // Extract clientMode from gallery config for password screen theming
        const galleryConfig = gallery.configuracoes as Record<string, unknown> | null;
        const clientMode = (galleryConfig?.clientMode as 'light' | 'dark') || 'light';
        
        return new Response(
          JSON.stringify({ 
            requiresPassword: true, 
            galleryId: gallery.id,
            sessionName: gallery.nome_sessao,
            clientMode: clientMode,  // Include for password screen theming
            // Include font settings for password screen styling
            settings: {
              sessionFont: galleryConfig?.sessionFont || undefined,
              titleCaseMode: galleryConfig?.titleCaseMode || 'normal',
            },
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate password
      if (password !== gallery.gallery_password) {
        return new Response(
          JSON.stringify({ error: "Senha incorreta", code: "WRONG_PASSWORD" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 4. Fetch pricing rules from session (source of truth) if gallery is linked
    let regrasCongeladas = gallery.regras_congeladas;
    
    if (gallery.session_id) {
      const { data: sessao, error: sessaoError } = await supabase
        .from("clientes_sessoes")
        .select("regras_congeladas")
        .eq("session_id", gallery.session_id)
        .single();
      
      if (!sessaoError && sessao?.regras_congeladas) {
        regrasCongeladas = sessao.regras_congeladas;
        console.log("📊 Loaded pricing rules from session:", gallery.session_id);
      }
    }

    // 5. Fetch photos for the gallery
    const { data: photos, error: photosError } = await supabase
      .from("galeria_fotos")
      .select("id, galeria_id, filename, original_filename, storage_key, original_path, preview_path, preview_wm_path, thumb_path, is_selected, is_favorite, comment, pasta_id, width, height, has_watermark, order_index, processing_status")
      .eq("galeria_id", gallery.id)
      .order("original_filename", { ascending: true });

    if (photosError) {
      console.error("Error fetching photos:", photosError);
    }

    // 5b. Fetch folders for the gallery
    const { data: folders } = await supabase
      .from("galeria_pastas")
      .select("id, nome, ordem, cover_photo_id")
      .eq("galeria_id", gallery.id)
      .order("ordem");

    // 6. Fetch photographer settings (for studio name, logo, etc.)
    const { data: settings } = await supabase
      .from("gallery_settings")
      .select("studio_name, studio_logo_url, favicon_url")
      .eq("user_id", gallery.user_id)
      .single();

    // 7. Build theme data - always return a theme object for consistent styling
    const galleryConfig = gallery.configuracoes as Record<string, unknown> | null;
    const themeId = galleryConfig?.themeId as string | undefined;
    const clientMode = (galleryConfig?.clientMode as 'light' | 'dark') || 'light';
    
    let themeData = null;
    if (themeId) {
      const { data: theme } = await supabase
        .from("gallery_themes")
        .select("*")
        .eq("id", themeId)
        .maybeSingle();
      
      if (theme) {
        // Updated schema: background_mode instead of background_color, emphasis_color instead of text_color
        themeData = {
          id: theme.id,
          name: theme.name,
          backgroundMode: theme.background_mode || 'light',
          primaryColor: theme.primary_color,
          accentColor: theme.accent_color,
          emphasisColor: theme.emphasis_color,
        };
        console.log("🎨 Loaded custom theme:", theme.name, "mode:", theme.background_mode);
      }
    }
    
    // CRITICAL: Always provide a theme object, using clientMode when no custom theme exists
    // This ensures the frontend consistently receives backgroundMode for all screens
    if (!themeData) {
      themeData = {
        id: 'system',
        name: 'Sistema',
        backgroundMode: clientMode, // Use photographer's chosen mode
        primaryColor: null,         // System defaults
        accentColor: null,
        emphasisColor: null,
      };
      console.log("🎨 Using system theme with mode:", clientMode);
    }

    // 8. Log first client access (upsert — partial unique index prevents duplicates)
    await supabase.from('galeria_acoes').upsert(
      {
        galeria_id: gallery.id,
        tipo: 'cliente_acessou',
        descricao: 'Cliente acessou a galeria pela primeira vez',
        user_id: null, // Anonymous client action
      },
      { onConflict: 'galeria_id,tipo', ignoreDuplicates: true }
    );
    console.log('📊 Access logged for gallery:', gallery.id);

    // 9. Return gallery data
    const saleSettings = gallery.configuracoes?.saleSettings || null;
    
    return new Response(
      JSON.stringify({
        success: true,
        gallery: {
          id: gallery.id,
          // userId removed — not needed by frontend, reduces public data exposure
          sessionId: gallery.session_id,  // Include session_id for client-side
          sessionName: gallery.nome_sessao,
          packageName: gallery.nome_pacote,
          clientName: gallery.cliente_nome,
          clienteId: gallery.cliente_id, // Include cliente_id for payment creation
          includedPhotos: gallery.fotos_incluidas,
          extraPhotoPrice: gallery.valor_foto_extra,
          welcomeMessage: gallery.mensagem_boas_vindas,
          deadline: gallery.prazo_selecao,
          status: gallery.status,
          selectionStatus: gallery.status_selecao,
          selectedCount: gallery.fotos_selecionadas,
          totalPhotos: gallery.total_fotos,
          settings: gallery.configuracoes,
          permissao: gallery.permissao,
          // Include frozen pricing rules (from session if available, else gallery)
          regrasCongeladas,
          // Include sale settings explicitly for payment flow
          saleSettings,
          // Include extras already paid for credit system
          extrasPagasTotal: gallery.total_fotos_extras_vendidas || 0,
          // Include amount already paid for credit calculation
          valorTotalVendido: gallery.valor_total_vendido || 0,
        },
        photos: photos || [],
        folders: folders || [],
        studioSettings: settings || null,
        // Theme data for client gallery appearance
        theme: themeData,
        clientMode: clientMode,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Gallery access error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
