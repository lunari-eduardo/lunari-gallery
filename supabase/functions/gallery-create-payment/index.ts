// gallery-create-payment v2.2.1-final (deploy 2026-08-03) (2026-08-03)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface PreloadedPayload {
  gallery?: {
    id: string;
    user_id: string;
    cliente_id: string | null;
    session_id: string | null;
    nome_sessao: string | null;
    public_token: string | null;
    fotos_incluidas?: number | null;
    regras_congeladas?: unknown;
  };
  valorCanonico?: number;
  extrasACobrar?: number;
  isFullyPaid?: boolean;
  provedor?: 'infinitepay' | 'mercadopago' | 'asaas' | string;
  sessionIdTexto?: string | null;
}

interface RequestBody {
  galleryId: string;
  valorTotal?: number;
  extraCount?: number;
  descricao?: string;
  provider?: string;
  context?: 'confirm_selection' | 'regenerate' | string;
  bypassPreSelecaoGate?: boolean;
  visitorId?: string;
  snapshotFotosIncluidas?: number;
  snapshotRegrasCongeladas?: unknown;
  correlationId?: string;
  // Fast-path: quando o caller já executou RPC canônica + integrações lookup.
  // Só é honrado se a Authorization contiver a service_role_key (chamada interna).
  preloaded?: PreloadedPayload;
}

interface PaymentResponse {
  success: boolean;
  checkoutUrl?: string;
  galleryUrl?: string;
  cobrancaId?: string;
  provedor?: string;
  valorTotal?: number;
  extraCount?: number;
  transparentCheckout?: boolean;
  alreadyPaid?: boolean;
  providerFallback?: string;
  code?: string;
  error?: string;
  message?: string;
}

const BASE_GALLERY_URL = 'https://gallery.lunarihub.com';
const INTERNAL_FN_TIMEOUT_MS = 25_000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json().catch(() => ({} as RequestBody));

    const {
      galleryId,
      provider,
      context,
      bypassPreSelecaoGate,
      visitorId,
      snapshotFotosIncluidas,
      snapshotRegrasCongeladas,
      correlationId,
      preloaded,
    } = body;

    // ── SEGURANÇA DO FAST-PATH ──
    // preloaded só é aceito quando a request veio com service role key
    // (chamada interna). Chamadas externas re-executam RPC/queries.
    const authHeader = req.headers.get('authorization') || '';
    const bearer = authHeader.replace(/^Bearer\s+/i, '');
    const isInternalCall = !!preloaded && bearer === supabaseServiceKey;
    const usePreloaded = isInternalCall;

    console.log(`[gcp][step:1 request] ${JSON.stringify({ galleryId, provider, context, visitorId: !!visitorId, preloaded: usePreloaded })}`);

    if (!galleryId) {
      return jsonResponse({ success: false, error: 'galleryId é obrigatório', code: 'MISSING_GALLERY_ID' }, 400);
    }

    // 1. Gallery — usa preloaded se disponível
    let gallery: any;
    if (usePreloaded && preloaded?.gallery) {
      gallery = preloaded.gallery;
    } else {
      const { data, error: galleryError } = await supabase
        .from('galerias')
        .select('id, user_id, cliente_id, session_id, nome_sessao, public_token, venda_pagamento_provedor, finalized_at, fotos_incluidas, regras_congeladas')
        .eq('id', galleryId)
        .single();

      if (galleryError || !data) {
        console.error('[gcp][step:2 gallery-fetch-error]', galleryError);
        return jsonResponse({ success: false, error: 'Galeria não encontrada', code: 'GALLERY_NOT_FOUND' }, 404);
      }
      gallery = data;
    }

    const galleryUrl = gallery.public_token ? `${BASE_GALLERY_URL}/g/${gallery.public_token}` : undefined;

    // 2. Cálculo canônico — pula se preloaded (R8 preservado; caller garantiu)
    let valorCanonico: number;
    let extrasACobrar: number;
    let isFullyPaid: boolean;
    const shouldBypassGate = bypassPreSelecaoGate === true || context === 'confirm_selection';

    if (usePreloaded && typeof preloaded?.valorCanonico === 'number' && typeof preloaded?.extrasACobrar === 'number') {
      valorCanonico = Number(preloaded.valorCanonico) || 0;
      extrasACobrar = Number(preloaded.extrasACobrar) || 0;
      isFullyPaid = preloaded.isFullyPaid === true;
      console.log(`[gcp][step:3 calc-preloaded] valor=${valorCanonico} extras=${extrasACobrar} fullyPaid=${isFullyPaid}`);
    } else {
      let calc: any = null;
      try {
        const rpcArgs: Record<string, unknown> = { p_gallery_id: galleryId };
        if (shouldBypassGate) rpcArgs.p_bypass_pre_selecao_gate = true;
        const { data, error: calcError } = await supabase.rpc('calculate_gallery_extra_payment', rpcArgs);
        if (calcError) throw calcError;
        calc = data || null;
      } catch (e) {
        console.error('[gcp][step:3 calc-error]', e);
        return jsonResponse({ success: false, error: 'Erro ao calcular valor canônico', code: 'CALC_ERROR' }, 500);
      }

      if (!calc?.success) {
        console.error('[gcp][step:3 calc-invalid]', calc);
        return jsonResponse({ success: false, error: 'Erro ao calcular valor da galeria', code: 'CALC_INVALID' }, 500);
      }

      valorCanonico = Number(calc.valor_a_cobrar || 0);
      extrasACobrar = Number(calc.extras_a_cobrar || 0);
      isFullyPaid = calc.is_fully_paid === true;
      console.log(`[gcp][step:3 calc-ok] valor=${valorCanonico} extras=${extrasACobrar} fullyPaid=${isFullyPaid} bypass=${shouldBypassGate}`);
    }

    // 2a. Sem saldo a cobrar → sucesso informativo
    if (valorCanonico <= 0 || isFullyPaid) {
      return jsonResponse({
        success: true,
        code: 'NO_AMOUNT_DUE',
        alreadyPaid: true,
        message: 'Galeria já quitada — não há saldo a cobrar',
        galleryUrl,
        valorTotal: 0,
        extraCount: 0,
      }, 200);
    }

    // 3. Provedor — usa preloaded se disponível
    let provedor: string;
    let providerFallback: string | undefined;

    if (usePreloaded && preloaded?.provedor) {
      provedor = preloaded.provedor;
    } else {
      const { data: integracoes } = await supabase
        .from('usuarios_integracoes')
        .select('provedor, is_default')
        .eq('user_id', gallery.user_id)
        .eq('status', 'ativo')
        .in('provedor', ['mercadopago', 'infinitepay', 'asaas']);

      if (!integracoes || integracoes.length === 0) {
        console.error('[gcp][step:4 no-provider]');
        return jsonResponse({ success: false, error: 'Nenhum provedor de pagamento configurado', code: 'NO_PROVIDER' }, 400);
      }

      const requested = provider || (gallery as any).venda_pagamento_provedor || null;
      provedor = requested;

      if (requested && !integracoes.find((i: any) => i.provedor === requested)) {
        const def = integracoes.find((i: any) => i.is_default) || integracoes[0];
        providerFallback = def.provedor;
        provedor = providerFallback;
        console.warn(`[gcp][step:4 provider-fallback] requested=${requested} → ${provedor}`);
      } else if (!requested) {
        const def = integracoes.find((i: any) => i.is_default) || integracoes[0];
        provedor = def.provedor;
      }
    }

    console.log(`[gcp][step:4 provider-ok] ${provedor}${providerFallback ? ' (fallback)' : ''}${usePreloaded ? ' (preloaded)' : ''}`);

    const descricao = `${extrasACobrar} foto${extrasACobrar !== 1 ? 's' : ''} extra${extrasACobrar !== 1 ? 's' : ''} - ${gallery.nome_sessao || 'Galeria'}`;

    // 3a. Cancela cobranças antigas pendentes — SELECT antes do UPDATE (D7)
    try {
      const { data: stale } = await supabase
        .from('cobrancas')
        .select('id')
        .eq('galeria_id', galleryId)
        .eq('finalidade', 'fotos_extras')
        .in('status', ['pendente', 'aguardando_confirmacao'])
        .limit(1);
      if (stale && stale.length > 0) {
        const { error: cancelError } = await supabase
          .from('cobrancas')
          .update({ status: 'cancelado', updated_at: new Date().toISOString() })
          .eq('galeria_id', galleryId)
          .eq('finalidade', 'fotos_extras')
          .in('status', ['pendente', 'aguardando_confirmacao']);
        if (cancelError) console.warn('[gcp][step:5 cancel-stale-warn]', cancelError);
      }
    } catch (e) {
      console.warn('[gcp][step:5 cancel-stale-exc]', e);
    }

    // 4. Asaas → checkout transparente no cliente; devolve apenas galleryUrl
    if (provedor === 'asaas') {
      await supabase
        .from('galerias')
        .update({ status_pagamento: 'pendente', updated_at: new Date().toISOString() })
        .eq('id', galleryId);

      return jsonResponse({
        success: true,
        provedor: 'asaas',
        galleryUrl,
        transparentCheckout: true,
        providerFallback,
        valorTotal: valorCanonico,
        extraCount: extrasACobrar,
        message: 'Envie o link da galeria ao cliente. O checkout Asaas abrirá automaticamente.',
      }, 200);
    }

    // 5. InfinitePay / Mercado Pago → chama create-link internamente
    const functionName = provedor === 'infinitepay' ? 'infinitepay-create-link' : 'mercadopago-create-link';
    const redirectUrl = galleryUrl ? `${galleryUrl}?payment=success` : undefined;

    // Normaliza session_id — usa preloaded se disponível
    let sessionIdTexto: string | null = null;
    if (usePreloaded && preloaded?.sessionIdTexto !== undefined) {
      sessionIdTexto = preloaded.sessionIdTexto;
    } else if (gallery.session_id) {
      if (gallery.session_id.startsWith('workflow-') || gallery.session_id.startsWith('session_')) {
        sessionIdTexto = gallery.session_id;
      } else {
        const { data: sessao } = await supabase
          .from('clientes_sessoes')
          .select('session_id')
          .or(`id.eq.${gallery.session_id},session_id.eq.${gallery.session_id}`)
          .maybeSingle();
        sessionIdTexto = sessao?.session_id || gallery.session_id;
      }
    }

    const payloadBody: Record<string, unknown> = {
      clienteId: gallery.cliente_id || null,
      sessionId: sessionIdTexto,
      valor: valorCanonico,
      descricao,
      userId: gallery.user_id,
      galeriaId: gallery.id,
      qtdFotos: extrasACobrar,
      galleryToken: gallery.public_token,
      visitorId: visitorId || undefined,
      snapshotFotosIncluidas: snapshotFotosIncluidas ?? (gallery as any).fotos_incluidas ?? 0,
      snapshotRegrasCongeladas: snapshotRegrasCongeladas ?? (gallery as any).regras_congeladas ?? null,
      correlationId: correlationId || undefined,
    };
    if (redirectUrl) payloadBody.redirectUrl = redirectUrl;

    console.log(`[gcp][step:6 calling] ${functionName} valor=${valorCanonico} qtd=${extrasACobrar}`);

    const fnUrl = `${supabaseUrl}/functions/v1/${functionName}`;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), INTERNAL_FN_TIMEOUT_MS);

    let fnResponse: Response;
    try {
      fnResponse = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify(payloadBody),
        signal: ac.signal,
      });
    } catch (e: any) {
      clearTimeout(timer);
      const aborted = e?.name === 'AbortError';
      console.error(`[gcp][step:6 ${aborted ? 'timeout' : 'fetch-error'}]`, e?.message || e);
      return jsonResponse({
        success: false,
        error: aborted ? 'Gateway do pagamento não respondeu a tempo' : 'Falha na comunicação com o gateway',
        code: aborted ? 'GATEWAY_TIMEOUT' : 'GATEWAY_UNREACHABLE',
      }, aborted ? 504 : 502);
    } finally {
      clearTimeout(timer);
    }

    const paymentData = await fnResponse.json().catch(() => ({} as any));

    if (!fnResponse.ok || !paymentData?.success) {
      console.error(`[gcp][step:6 upstream-error] status=${fnResponse.status}`, paymentData);
      return jsonResponse({
        success: false,
        error: paymentData?.error || `Erro ao criar link de pagamento (${provedor})`,
        code: paymentData?.code || 'PAYMENT_CREATE_ERROR',
      }, 502);
    }

    const checkoutUrl = paymentData.checkoutUrl || paymentData.paymentLink;
    const cobrancaId = paymentData.cobrancaId || paymentData.cobranca?.id;

    await supabase
      .from('galerias')
      .update({ status_pagamento: 'pendente', updated_at: new Date().toISOString() })
      .eq('id', galleryId);

    console.log(`[gcp][step:7 done] provedor=${provedor} cobrancaId=${cobrancaId}`);

    return jsonResponse({
      success: true,
      checkoutUrl,
      galleryUrl,
      cobrancaId,
      provedor,
      providerFallback,
      valorTotal: valorCanonico,
      extraCount: extrasACobrar,
    }, 200);

  } catch (error) {
    console.error('[gcp][fatal]', error);
    return jsonResponse({ success: false, error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' }, 500);
  }
});

function jsonResponse(body: PaymentResponse, status: number): Response {
  return new Response(JSON.stringify({ ...body, version: GCP_VERSION }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-gcp-version': GCP_VERSION },
  });
}
