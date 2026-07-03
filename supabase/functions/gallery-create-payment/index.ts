import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface RequestBody {
  galleryId: string;
  // Todos opcionais — valor/qtd/descricao são recalculados via RPC canônica.
  valorTotal?: number;
  extraCount?: number;
  descricao?: string;
  provider?: string;
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
  code?: string;
  error?: string;
  message?: string;
}

const BASE_GALLERY_URL = 'https://gallery.lunarihub.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();
    const { galleryId, provider } = body;

    console.log(`[gallery-create-payment] Request:`, JSON.stringify({ galleryId, provider }));

    if (!galleryId) {
      return jsonResponse({ success: false, error: 'galleryId é obrigatório' }, 400);
    }

    // 1. Fetch gallery
    const { data: gallery, error: galleryError } = await supabase
      .from('galerias')
      .select('id, user_id, cliente_id, session_id, nome_sessao, public_token, venda_pagamento_provedor, finalized_at')
      .eq('id', galleryId)
      .single();

    if (galleryError || !gallery) {
      console.error('[gallery-create-payment] Gallery fetch error:', galleryError);
      return jsonResponse({ success: false, error: 'Galeria não encontrada', code: 'GALLERY_NOT_FOUND' }, 404);
    }

    // 2. CANONICAL CALCULATION — fonte única de valor/qtd (R8 gallery-rules)
    let calc: any = null;
    try {
      const { data } = await supabase.rpc('calculate_gallery_extra_payment', { p_gallery_id: galleryId });
      calc = data || null;
    } catch (e) {
      console.error('[gallery-create-payment] calculate_gallery_extra_payment falhou:', e);
      return jsonResponse({ success: false, error: 'Erro ao calcular valor canônico', code: 'CALC_ERROR' }, 500);
    }

    if (!calc?.success) {
      return jsonResponse({ success: false, error: 'Erro ao calcular valor da galeria', code: 'CALC_INVALID' }, 500);
    }

    const valorCanonico = Number(calc.valor_a_cobrar || 0);
    const extrasACobrar = Number(calc.extras_a_cobrar || 0);
    const isFullyPaid = calc.is_fully_paid === true;

    console.log(`[gallery-create-payment] Canonical calc: valor=${valorCanonico}, extras=${extrasACobrar}, fullyPaid=${isFullyPaid}`);

    // 2a. Se não há saldo, retorna sucesso sem criar cobrança
    if (valorCanonico <= 0 || isFullyPaid) {
      return jsonResponse({
        success: true,
        code: 'NO_AMOUNT_DUE',
        message: 'Não há saldo a cobrar para esta galeria',
        galleryUrl: gallery.public_token ? `${BASE_GALLERY_URL}/g/${gallery.public_token}` : undefined,
        valorTotal: 0,
        extraCount: 0,
      }, 200);
    }

    // 3. Discover active payment provider
    let provedor = provider || (gallery as any).venda_pagamento_provedor || null;

    if (provedor) {
      const { data: integracao } = await supabase
        .from('usuarios_integracoes')
        .select('provedor')
        .eq('user_id', gallery.user_id)
        .eq('status', 'ativo')
        .eq('provedor', provedor)
        .maybeSingle();

      if (!integracao) {
        return jsonResponse({ success: false, error: `Provedor ${provedor} não está ativo`, code: 'PROVIDER_INACTIVE' }, 400);
      }
    } else {
      // Auto-detect provider (prefer default)
      const { data: integracoes } = await supabase
        .from('usuarios_integracoes')
        .select('provedor, is_default')
        .eq('user_id', gallery.user_id)
        .eq('status', 'ativo')
        .in('provedor', ['mercadopago', 'infinitepay', 'asaas']);

      if (!integracoes || integracoes.length === 0) {
        return jsonResponse({ success: false, error: 'Nenhum provedor de pagamento configurado', code: 'NO_PROVIDER' }, 400);
      }

      const defaultInteg = integracoes.find((i: any) => i.is_default) || integracoes[0];
      provedor = defaultInteg.provedor;
    }

    console.log(`[gallery-create-payment] Provider: ${provedor}`);

    const galleryUrl = gallery.public_token ? `${BASE_GALLERY_URL}/g/${gallery.public_token}` : undefined;
    const descricao = `${extrasACobrar} foto${extrasACobrar !== 1 ? 's' : ''} extra${extrasACobrar !== 1 ? 's' : ''} - ${gallery.nome_sessao || 'Galeria'}`;

    // 3a. Cancel stale pending charges (evita duplicatas + valor errado)
    try {
      await supabase
        .from('cobrancas')
        .update({ status: 'cancelado', updated_at: new Date().toISOString() })
        .eq('galeria_id', galleryId)
        .eq('finalidade', 'fotos_extras')
        .in('status', ['pendente', 'aguardando_confirmacao']);
    } catch (e) {
      console.warn('[gallery-create-payment] Falha ao cancelar cobranças antigas:', e);
    }

    // 4. Asaas → NÃO cria cobrança aqui; deixa AsaasCheckout no cliente criar via asaas-gallery-payment.
    //    Retorna apenas galleryUrl para o fotógrafo enviar ao cliente.
    if (provedor === 'asaas') {
      // Garante estado pendente/finalized da galeria (finalized_at preservado)
      await supabase
        .from('galerias')
        .update({
          status_pagamento: 'pendente',
          updated_at: new Date().toISOString(),
        })
        .eq('id', galleryId);

      return jsonResponse({
        success: true,
        provedor: 'asaas',
        galleryUrl,
        transparentCheckout: true,
        valorTotal: valorCanonico,
        extraCount: extrasACobrar,
        message: 'Envie o link da galeria ao cliente. O checkout Asaas abrirá automaticamente.',
      }, 200);
    }

    // 5. InfinitePay / Mercado Pago → chama create-link internamente com valor canônico
    const functionName = provedor === 'infinitepay' ? 'infinitepay-create-link' : 'mercadopago-create-link';
    const redirectUrl = galleryUrl ? `${galleryUrl}?payment=success` : undefined;

    // Normalize session_id to text format
    let sessionIdTexto: string | null = null;
    if (gallery.session_id) {
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
      clienteId: gallery.cliente_id,
      sessionId: sessionIdTexto,
      valor: valorCanonico,
      descricao,
      userId: gallery.user_id,
      galeriaId: gallery.id,
      qtdFotos: extrasACobrar,
      galleryToken: gallery.public_token,
    };

    if (redirectUrl) payloadBody.redirectUrl = redirectUrl;

    console.log(`[gallery-create-payment] Calling ${functionName} with valor=${valorCanonico}, qtd=${extrasACobrar}`);

    const fnUrl = `${supabaseUrl}/functions/v1/${functionName}`;
    const fnResponse = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify(payloadBody),
    });

    const paymentData = await fnResponse.json().catch(() => ({}));

    if (!fnResponse.ok || !paymentData?.success) {
      console.error(`[gallery-create-payment] ${functionName} error:`, paymentData);
      return jsonResponse({
        success: false,
        error: paymentData?.error || 'Erro ao criar link de pagamento',
        code: paymentData?.code || 'PAYMENT_CREATE_ERROR',
      }, 500);
    }

    const checkoutUrl = paymentData.checkoutUrl || paymentData.paymentLink;
    const cobrancaId = paymentData.cobrancaId || paymentData.cobranca?.id;

    // Update gallery status to pending
    await supabase
      .from('galerias')
      .update({
        status_pagamento: 'pendente',
        updated_at: new Date().toISOString(),
      })
      .eq('id', galleryId);

    return jsonResponse({
      success: true,
      checkoutUrl,
      galleryUrl,
      cobrancaId,
      provedor,
      valorTotal: valorCanonico,
      extraCount: extrasACobrar,
    }, 200);

  } catch (error) {
    console.error('[gallery-create-payment] Fatal error:', error);
    return jsonResponse({ success: false, error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' }, 500);
  }
});

function jsonResponse(body: PaymentResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
