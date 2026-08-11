
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolvePayerHints } from '../_shared/payer-hints.ts'

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

    // 2. Pre-fetch studio settings (detailed) + nome do fotógrafo (profiles).
    const [{ data: settings }, { data: ownerProfile }] = await Promise.all([
      supabase
        .from('gallery_settings')
        .select('*')
        .eq('user_id', gallery.user_id)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('nome_completo')
        .eq('id', gallery.user_id)
        .maybeSingle(),
    ]);

    // Injeta photographer_name em studioSettings sem alterar o shape existente.
    // Frontend usa esse campo para derivar o primeiro nome no PreCheckoutContactStep.
    const photographerName: string | null =
      (ownerProfile?.nome_completo && String(ownerProfile.nome_completo).trim()) ||
      (settings?.studio_name && String(settings.studio_name).trim()) ||
      null;
    const settingsWithOwner = settings
      ? { ...settings, photographer_name: photographerName }
      : (photographerName ? { photographer_name: photographerName } : null);

    // Resolve owner settings (account theme)
    const accountTheme = settingsWithOwner;


    // 3. Check password if private (só exige senha se realmente houver uma cadastrada)
    const hasPassword = typeof gallery.gallery_password === 'string' && gallery.gallery_password.length > 0;
    if (gallery.permissao === 'private' && hasPassword && gallery.gallery_password !== password) {
      return new Response(JSON.stringify({
        success: true,
        requiresPassword: true,
        sessionName: gallery.nome_sessao,
        studioSettings: settingsWithOwner,
        error: password ? 'Senha incorreta' : undefined,
        code: password ? 'WRONG_PASSWORD' : 'AUTH_REQUIRED'
      }), {
        status: password ? 401 : 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2.5 TRACKING: Marcar galeria como acessada/em seleção no primeiro acesso
    // Isso garante que o fotógrafo veja que o cliente abriu o link no Kanban, 
    // mesmo que ele ainda não tenha selecionado a primeira foto.
    if (gallery.status === 'enviado') {
      try {
        await supabase
          .from('galerias')
          .update({ status: 'selecao_iniciada', updated_at: new Date().toISOString() })
          .eq('id', gallery.id);
          
        console.log(`[gallery-access] Tracking: Galeria ${gallery.id} marcada como selecao_iniciada no primeiro acesso`);
      } catch (err) {
        console.error('[gallery-access] Erro ao atualizar status para selecao_iniciada:', err);
      }
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
    let isFinalized = currentSelectionStatus === 'selecao_completa' || visitorSelectionStatus === 'selecao_completa';

    // 🔒 selectionLocked: verdade única — uma vez travada NUNCA reverte.
    // Baseado em finalized_at OU status_selecao pós-confirmação.
    const galleryFinalizedAt = (gallery as any).finalized_at;
    let visitorFinalizedAt: string | null = null;
    if (visitorId) {
      const { data: vRow } = await supabase
        .from('galeria_visitantes')
        .select('finalized_at')
        .eq('id', visitorId)
        .maybeSingle();
      visitorFinalizedAt = (vRow as any)?.finalized_at || null;
    }
    const selectionLocked = Boolean(
      galleryFinalizedAt ||
      visitorFinalizedAt ||
      ['aguardando_pagamento', 'selecao_completa', 'processando_selecao'].includes(currentSelectionStatus) ||
      (visitorSelectionStatus && ['aguardando_pagamento', 'selecao_completa', 'processando_selecao'].includes(visitorSelectionStatus))
    );

    // Auto-heal via RPC canônica: se há cobranças pagas não contabilizadas,
    // invocar finalize_gallery_payment (idempotente). NUNCA fazer UPDATE
    // direto em status_selecao aqui — a RPC é fonte única de verdade.
    let hasPending = false;
    let hasAnyPaidCharge = false; // Existe QUALQUER cobrança paga no histórico
    let hasPaid = false;           // Seleção atual está TOTALMENTE quitada (canônico)
    let canonicalCalc: any = null; // Resultado de calculate_gallery_extra_payment

    if (selectionLocked) {
      const { data: charges } = await supabase
        .from('cobrancas')
        .select('id, status, extras_contabilizados')
        .eq('galeria_id', gallery.id)
        .eq('finalidade', 'fotos_extras');

      hasPending = charges?.some((c: any) => ['pendente', 'aguardando_confirmacao'].includes(c.status)) || false;
      hasAnyPaidCharge = charges?.some((c: any) => ['pago', 'pago_manual'].includes(c.status)) || false;

      if (hasAnyPaidCharge) {
        const needsHeal = (charges || []).filter(
          (c: any) => ['pago', 'pago_manual'].includes(c.status) && c.extras_contabilizados !== true
        );
        for (const c of needsHeal) {
          try {
            await supabase.rpc('finalize_gallery_payment', {
              p_cobranca_id: c.id,
              p_receipt_url: null,
              p_paid_at: new Date().toISOString(),
              p_manual_method: null,
              p_manual_obs: null,
            });
          } catch (healErr) {
            console.error(`[gallery-access] Auto-heal falhou para cobrança ${c.id}:`, healErr);
          }
        }
      }

      // 🎯 Cálculo canônico — fonte única para decidir hasPaid/valorACobrar.
      // Roda DEPOIS do auto-heal para refletir agregados atualizados.
      try {
        const { data: calc } = await supabase.rpc('calculate_gallery_extra_payment', { p_gallery_id: gallery.id });
        canonicalCalc = calc || null;
      } catch (e) {
        console.error('[gallery-access] calculate_gallery_extra_payment falhou:', e);
      }

      // hasPaid canônico: seleção atual está totalmente quitada.
      // Só é `true` quando a RPC confirma is_fully_paid=true E existe pelo menos
      // uma cobrança paga (evita hasPaid=true em galeria travada sem nenhum pagamento).
      // Fecha o bug em que galerias reativadas com crédito parcial marcavam
      // hasPaid=true por causa do histórico e reabriam o grid indevidamente.
      hasPaid = Boolean(
        (canonicalCalc as any)?.is_fully_paid === true &&
        hasAnyPaidCharge
      );

      if (hasPaid && !hasPending) {
        const { data: refreshed } = await supabase
          .from('galerias')
          .select('status_selecao')
          .eq('id', gallery.id)
          .maybeSingle();
        if (refreshed?.status_selecao === 'selecao_completa') {
          currentSelectionStatus = 'selecao_completa';
          isFinalized = true;
        }
        if (visitorId) {
          await supabase
            .from('galeria_visitantes')
            .update({ status_selecao: 'selecao_completa', updated_at: new Date().toISOString() })
            .eq('id', visitorId);
          visitorSelectionStatus = 'selecao_completa';
          isFinalized = true;
        }
      }
    }

    // 🛡️ BLINDAGEM: Se travada e não totalmente paga, NUNCA reportar como finalizada.
    if (selectionLocked && !hasPaid) {
      isFinalized = false;
    }

    // Pending payment sempre que selectionLocked && !hasPaid, mesmo sem cobrança viva.
    // (Inclui casos parciais: existe cobrança paga antiga mas ainda há saldo devedor.)
    if (selectionLocked && !hasPaid && !pendingPaymentData) {

      const { data: cobranca } = await supabase
        .from('cobrancas')
        .select('*')
        .eq('galeria_id', gallery.id)
        .eq('finalidade', 'fotos_extras')
        .in('status', ['pendente', 'aguardando_confirmacao'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Valor a cobrar canônico — sempre prioriza RPC sobre cobranca.valor
      const valorCanonico = Number((canonicalCalc as any)?.valor_a_cobrar ?? 0);
      const qtdExtrasCanonico = Number((canonicalCalc as any)?.extras_a_cobrar ?? 0);

      if (cobranca) {
        // Fallback multi-provedor para checkoutUrl (InfinitePay OU MercadoPago)
        const checkoutUrl =
          (cobranca as any).ip_checkout_url ||
          (cobranca as any).mp_payment_link ||
          null;

        // Reconstitui asaasCheckoutData quando cliente retorna com cobrança
        // Asaas pendente OU aguardando_confirmacao — o checkout transparente precisa desse payload.
        let asaasCheckoutData: Record<string, unknown> | null = null;
        if (cobranca.provedor === 'asaas' && ['pendente','aguardando_confirmacao'].includes(cobranca.status)) {
          const { data: integracao } = await supabase
            .from('usuarios_integracoes')
            .select('dados_extras')
            .eq('user_id', gallery.user_id)
            .eq('provedor', 'asaas')
            .eq('status', 'ativo')
            .maybeSingle();
          const s = (integracao?.dados_extras || {}) as Record<string, any>;
          // Priorizar valor canônico: se saldo real (canônico) diverge da cobrança viva,
          // significa que a cobrança está defasada — usar canônico para não cobrar valor errado.
          const valorEfetivo = valorCanonico > 0 ? valorCanonico : Number(cobranca.valor || 0);
          const qtdEfetiva = qtdExtrasCanonico > 0 ? qtdExtrasCanonico : (cobranca.qtd_fotos || 0);
          asaasCheckoutData = {
            galeriaId: gallery.id,
            userId: gallery.user_id,
            valorTotal: valorEfetivo,
            descricao: cobranca.descricao || `Fotos extras - ${gallery.nome_sessao || 'Galeria'}`,
            qtdFotos: qtdEfetiva,
            clienteId: gallery.cliente_id,
            sessionId: gallery.session_id,
            galleryToken: gallery.public_token,
            visitorId: visitorId || undefined,
            cobrancaId: cobranca.id,
            enabledMethods: {
              pix: s.habilitarPix !== false,
              creditCard: s.habilitarCartao !== false,
              boleto: s.habilitarBoleto === true,
            },
            maxParcelas: s.maxParcelas || 12,
            absorverTaxa: s.absorverTaxa || false,
            snapshotFotosIncluidas: gallery.fotos_incluidas || 0,
            snapshotRegrasCongeladas: gallery.regras_congeladas,
          };
        }

        let pendingAction: {
          kind: 'external_redirect' | 'asaas_modal' | 'pix_modal' | 'regenerate';
          checkoutUrl?: string | null;
          provedor: string;
        };
        if (cobranca.provedor === 'asaas' && asaasCheckoutData) {
          pendingAction = { kind: 'asaas_modal', provedor: 'asaas' };
        } else if (cobranca.provedor === 'pix_manual') {
          pendingAction = { kind: 'pix_modal', provedor: 'pix_manual' };
        } else if (checkoutUrl) {
          pendingAction = { kind: 'external_redirect', checkoutUrl, provedor: cobranca.provedor };
        } else {
          pendingAction = { kind: 'regenerate', provedor: cobranca.provedor };
        }

        pendingPaymentData = {
          pendingPayment: true,
          paymentMethod: cobranca.provedor,
          checkoutUrl,
          cobrancaId: cobranca.id,
          valorTotal: valorCanonico > 0 ? valorCanonico : Number(cobranca.valor || 0),
          pixDados: (gallery.configuracoes as any)?.pixDados,
          asaasCheckoutData,
          pendingAction,
        };
      } else {
        // Sem cobrança viva mas travada: reconstituir dados canônicos.
        const provedor = (gallery as any).venda_pagamento_provedor || null;

        let asaasCheckoutData: Record<string, unknown> | null = null;
        let pendingAction: any = { kind: 'regenerate', provedor: provedor || 'desconhecido' };

        if (provedor === 'asaas' && valorCanonico > 0) {
          const { data: integracao } = await supabase
            .from('usuarios_integracoes')
            .select('dados_extras')
            .eq('user_id', gallery.user_id)
            .eq('provedor', 'asaas')
            .eq('status', 'ativo')
            .maybeSingle();
          const s = (integracao?.dados_extras || {}) as Record<string, any>;
          const descricao = `${qtdExtrasCanonico} foto${qtdExtrasCanonico !== 1 ? 's' : ''} extra${qtdExtrasCanonico !== 1 ? 's' : ''} - ${gallery.nome_sessao || 'Galeria'}`;
          asaasCheckoutData = {
            galeriaId: gallery.id,
            userId: gallery.user_id,
            valorTotal: valorCanonico,
            descricao,
            qtdFotos: qtdExtrasCanonico,
            clienteId: gallery.cliente_id,
            sessionId: gallery.session_id,
            galleryToken: gallery.public_token,
            visitorId: visitorId || undefined,
            enabledMethods: {
              pix: s.habilitarPix !== false,
              creditCard: s.habilitarCartao !== false,
              boleto: s.habilitarBoleto === true,
            },
            maxParcelas: s.maxParcelas || 12,
            absorverTaxa: s.absorverTaxa || false,
            ireiAntecipar: s.ireiAntecipar ?? s.incluirTaxaAntecipacao ?? false,
            repassarTaxaAntecipacao: s.repassarTaxaAntecipacao ?? s.incluirTaxaAntecipacao ?? false,
            taxaAntecipacao: s.taxaAntecipacao || false,
            taxaAntecipacaoPercentual: s.taxaAntecipacaoPercentual,
            taxaAntecipacaoCreditoAvista: s.taxaAntecipacaoCreditoAvista,
            taxaAntecipacaoCreditoParcelado: s.taxaAntecipacaoCreditoParcelado,
            incluirTaxaAntecipacao: s.incluirTaxaAntecipacao ?? true,
            snapshotFotosIncluidas: gallery.fotos_incluidas || 0,
            snapshotRegrasCongeladas: gallery.regras_congeladas,
          };
          pendingAction = { kind: 'asaas_modal', provedor: 'asaas' };
        } else if (provedor === 'pix_manual') {
          pendingAction = { kind: 'pix_modal', provedor: 'pix_manual' };
        }

        pendingPaymentData = {
          pendingPayment: true,
          awaitingCharge: asaasCheckoutData ? false : true,
          paymentMethod: provedor,
          checkoutUrl: null,
          cobrancaId: null,
          valorTotal: valorCanonico,
          pixDados: (gallery.configuracoes as any)?.pixDados,
          asaasCheckoutData,
          needsRegeneration: (gallery as any).payment_needs_regeneration === true,
          pendingAction,
        };
      }

    }





    // R3 (gallery-rules): Filtro de fotos e blockedReason canônico.
    // - Travada e NÃO paga => photos:[] (nenhum grid de seleção possível no cliente).
    // - Travada e paga => devolve apenas selecionadas (preview finalizado).
    let filteredPhotos = photos || [];
    let blockedReason: 'awaiting_payment' | 'awaiting_charge_regeneration' | 'finalized_paid' | null = null;
    if (selectionLocked && !hasPaid) {
      filteredPhotos = [];
      blockedReason = (pendingPaymentData as any)?.awaitingCharge
        ? 'awaiting_charge_regeneration'
        : 'awaiting_payment';
    } else if (isFinalized) {
      blockedReason = 'finalized_paid';
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

    // 4.1. Normalize saleSettings — canonical columns > JSON > default.
    // Frontend NEVER derives sale mode from any other source. This is the single
    // source of truth exposed to the client (see .lovable/pipeline-galeria-pagamento.md).
    const rawSaleSettings = (galleryConfig?.saleSettings || {}) as Record<string, unknown>;
    const canonicalSaleMode = (gallery as any).venda_modo
      || (rawSaleSettings.mode as string | undefined)
      || 'no_sale';
    const canonicalPaymentMethod = (gallery as any).venda_pagamento_provedor
      || (rawSaleSettings.paymentMethod as string | undefined)
      || null;
    const canonicalChargeType = (gallery as any).venda_tipo_cobranca
      || (rawSaleSettings.chargeType as string | undefined)
      || 'only_extras';
    const normalizedSaleSettings = {
      mode: canonicalSaleMode,
      paymentMethod: canonicalPaymentMethod,
      chargeType: canonicalChargeType,
      pricingModel: (rawSaleSettings.pricingModel as string | undefined) || 'fixed',
      fixedPrice: rawSaleSettings.fixedPrice as number | undefined,
      discountPackages: (rawSaleSettings.discountPackages as unknown[]) || [],
    };
    const saleModeSource: 'column' | 'json' | 'default' =
      (gallery as any).venda_modo ? 'column'
      : (rawSaleSettings.mode ? 'json' : 'default');
    if ((rawSaleSettings.mode as string | undefined) && (gallery as any).venda_modo
        && rawSaleSettings.mode !== (gallery as any).venda_modo) {
      console.warn(`[gallery-access] SALE_MODE_DIVERGENCE gallery=${gallery.id} column=${(gallery as any).venda_modo} json=${rawSaleSettings.mode}`);
    }


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

    // Payer hints missing (booleans only — não expõe valores).
    // Usado no ClientGallery para decidir se abre o modal de coleta antes do
    // redirect ao checkout. Inclui `cpfCnpj` + provedor ativo para que o
    // frontend saiba quando o Asaas exige CPF (regra do BC / PIX).
    let payerHintsMissing: {
      email: boolean;
      phone: boolean;
      name: boolean;
      cpfCnpj: boolean;
      provider: 'asaas' | 'infinitepay' | 'mercadopago' | null;
      billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO' | null;
      cpfRequired: boolean;
    } | null = null;
    // Valores seguros já conhecidos do pagador — usados para pré-preencher o checkout
    // (evita reabrir modal e economiza digitação do cliente na mesma galeria).
    let payerHintsValues: {
      fullName: string | null;
      email: string | null;
      phone: string | null;
      cpfCnpj: string | null;
    } | null = null;
    try {
      const hints = await resolvePayerHints(supabase, {
        clienteId: gallery.cliente_id,
        visitorId: visitorId || null,
      });

      // Descobre provider ativo (default) para decidir requisitos.
      let provider: 'asaas' | 'infinitepay' | 'mercadopago' | null = null;
      let billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO' | null = null;
      const { data: integracoes } = await supabase
        .from('usuarios_integracoes')
        .select('provedor, dados_extras, is_default')
        .eq('user_id', gallery.user_id)
        .eq('status', 'ativo')
        .in('provedor', ['asaas', 'infinitepay', 'mercadopago']);
      if (integracoes && integracoes.length > 0) {
        const chosen = integracoes.find((i: any) => i.is_default) || integracoes[0];
        provider = chosen.provedor as any;
        if (provider === 'asaas') {
          const raw = (chosen.dados_extras || {}) as Record<string, any>;
          const s = { ...raw, ...(raw.gallery_settings || {}) };
          billingType = s.habilitarPix ? 'PIX' : s.habilitarCartao ? 'CREDIT_CARD' : s.habilitarBoleto ? 'BOLETO' : 'PIX';
        }
      }

      const cpfRequired = provider === 'asaas';
      payerHintsMissing = {
        email: !hints.email,
        phone: !hints.phone,
        name: !hints.firstName,
        cpfCnpj: cpfRequired && !hints.cpfCnpj,
        provider,
        billingType,
        cpfRequired,
      };
      payerHintsValues = {
        fullName: hints.fullName || null,
        email: hints.email || null,
        phone: hints.phone || null,
        cpfCnpj: hints.cpfCnpj || null,
      };
    } catch (e) {
      console.warn('[gallery-access] payer hints resolve falhou:', e instanceof Error ? e.message : String(e));
    }

    // 6. Response
    return new Response(
      JSON.stringify({
        success: true,
        deliver: gallery.tipo === 'entrega',
        galleryId: gallery.id,
        gallery: {
          id: gallery.id,
          sessionId: gallery.session_id || null,
          sessionName: gallery.nome_sessao,
          clientName: gallery.cliente_nome,
          clientEmail: gallery.cliente_email,
          packageName: gallery.nome_pacote,
          includedPhotos: gallery.fotos_incluidas,
          extraPhotoPrice: Number(gallery.valor_foto_extra || 0),
          // regras_congeladas: fonte de verdade dos descontos progressivos.
          // Para galerias do Studio, é preenchida pelo trigger
          // `sync_galeria_regras_from_session` a partir de clientes_sessoes.
          regrasCongeladas: gallery.regras_congeladas || null,
          selectionStatus: currentSelectionStatus,
          welcomeMessage: gallery.mensagem_boas_vindas,
          expirationDate: gallery.prazo_selecao,
          publicToken: gallery.public_token,
          // Agregados de créditos (fonte única: DB + RPC canônica)
          extrasPagasTotal: Number((canonicalCalc as any)?.extras_pagas ?? gallery.total_fotos_extras_vendidas ?? 0),
          totalFotosExtrasVendidas: Number(gallery.total_fotos_extras_vendidas ?? 0),
          valorTotalVendido: Number((canonicalCalc as any)?.valor_pago ?? gallery.valor_total_vendido ?? 0),
          // Cálculo canônico para a rodada atual — evita frontend recalcular errado
          canonicalCalc: canonicalCalc || null,
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
          // Sale settings canônicos (colunas > JSON). Frontend consome exclusivamente daqui.
          saleSettings: normalizedSaleSettings,
          saleModeSource,

        },

        photos: filteredPhotos,
        finalized: isFinalized,
        selectionLocked,
        hasPaid,
        blockedReason,
        finalizedAt: galleryFinalizedAt || visitorFinalizedAt || null,
        folders: folders || [],

        studioSettings: settingsWithOwner || null,
        theme: themeData,
        clientMode,
        accountTheme, // New field for account heritage info
        payerHintsMissing,
        payerHints: payerHintsValues,
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
