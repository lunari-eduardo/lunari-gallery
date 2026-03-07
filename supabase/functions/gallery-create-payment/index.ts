import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface RequestBody {
  galleryId: string;
  valorTotal: number;
  extraCount: number;
  descricao?: string;
  provider?: string; // optional: force specific provider
}

interface PaymentResponse {
  success: boolean;
  checkoutUrl?: string;
  cobrancaId?: string;
  provedor?: string;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();
    const { galleryId, valorTotal, extraCount, descricao, provider } = body;

    if (!galleryId) {
      return new Response(
        JSON.stringify({ success: false, error: 'galleryId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!valorTotal || valorTotal <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'valorTotal deve ser maior que zero' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Fetch gallery data
    const { data: gallery, error: galleryError } = await supabase
      .from('galerias')
      .select('id, user_id, cliente_id, session_id, nome_sessao, public_token')
      .eq('id', galleryId)
      .single();

    if (galleryError || !gallery) {
      console.error('Gallery fetch error:', galleryError);
      return new Response(
        JSON.stringify({ success: false, error: 'Galeria não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Discover active payment provider
    let provedor = provider;
    
    if (provedor) {
      // Verify the requested provider is active
      const { data: integracao } = await supabase
        .from('usuarios_integracoes')
        .select('provedor, dados_extras, access_token')
        .eq('user_id', gallery.user_id)
        .eq('status', 'ativo')
        .eq('provedor', provedor)
        .maybeSingle();
      
      if (!integracao) {
        return new Response(
          JSON.stringify({ success: false, error: `Provedor ${provedor} não está ativo`, code: 'PROVIDER_INACTIVE' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Auto-detect active provider (prefer default)
      const { data: integracoes } = await supabase
        .from('usuarios_integracoes')
        .select('provedor, dados_extras, access_token, is_default')
        .eq('user_id', gallery.user_id)
        .eq('status', 'ativo')
        .in('provedor', ['mercadopago', 'infinitepay']);

      if (!integracoes || integracoes.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Nenhum provedor de pagamento configurado', code: 'NO_PROVIDER' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const defaultInteg = integracoes.find(i => i.is_default) || integracoes[0];
      provedor = defaultInteg.provedor;
    }

    console.log(`📱 Payment provider: ${provedor} for gallery ${galleryId}`);

    // 3. Normalize session_id to TEXT format
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

    // 4. Build description
    const cobrancaDescricao = descricao || 
      `${extraCount} foto${extraCount !== 1 ? 's' : ''} extra${extraCount !== 1 ? 's' : ''} - ${gallery.nome_sessao || 'Galeria'}`;

    // 5. Build the complete payload for the create-link function
    const functionName = provedor === 'infinitepay' 
      ? 'infinitepay-create-link' 
      : 'mercadopago-create-link';

    // Build redirect URL for payment return
    const redirectUrl = gallery.public_token 
      ? `https://gallery.lunarihub.com/g/${gallery.public_token}?payment=success`
      : undefined;

    const payloadBody: Record<string, unknown> = {
      clienteId: gallery.cliente_id,
      sessionId: sessionIdTexto,
      valor: valorTotal,
      descricao: cobrancaDescricao,
      userId: gallery.user_id,
      galeriaId: gallery.id,
      qtdFotos: extraCount,
      galleryToken: gallery.public_token,
    };

    if (redirectUrl) {
      payloadBody.redirectUrl = redirectUrl;
    }

    console.log(`📞 Calling ${functionName} with:`, payloadBody);

    // Use direct fetch for internal function call (per contract)
    const fnUrl = `${supabaseUrl}/functions/v1/${functionName}`;
    const fnResponse = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify(payloadBody),
    });

    const paymentData = await fnResponse.json();

    if (!fnResponse.ok || !paymentData?.success) {
      console.error(`${functionName} error:`, paymentData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: paymentData?.error || 'Erro ao criar link de pagamento',
          code: 'PAYMENT_CREATE_ERROR'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Extract checkout URL
    const checkoutUrl = provedor === 'infinitepay'
      ? paymentData.checkoutUrl
      : paymentData.paymentLink;

    const cobrancaId = provedor === 'infinitepay'
      ? paymentData.cobrancaId
      : paymentData.cobranca?.id;

    // 7. Update gallery with payment info
    await supabase
      .from('galerias')
      .update({
        status_pagamento: 'pendente',
        updated_at: new Date().toISOString(),
      })
      .eq('id', galleryId);

    console.log(`✅ Payment created: ${cobrancaId} via ${provedor}`);

    const response: PaymentResponse = {
      success: true,
      checkoutUrl,
      cobrancaId,
      provedor,
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Gallery payment error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
