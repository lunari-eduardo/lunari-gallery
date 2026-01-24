import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  galleryId: string;
  valorTotal: number;
  extraCount: number;
  descricao?: string;
}

interface PaymentResponse {
  success: boolean;
  checkoutUrl?: string;
  cobrancaId?: string;
  provedor?: string;
  error?: string;
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

    const body: RequestBody = await req.json();
    const { galleryId, valorTotal, extraCount, descricao } = body;

    // Validate required fields
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
      .select('id, user_id, cliente_id, session_id, nome_sessao')
      .eq('id', galleryId)
      .single();

    if (galleryError || !gallery) {
      console.error('Gallery fetch error:', galleryError);
      return new Response(
        JSON.stringify({ success: false, error: 'Galeria não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Discover active payment provider for this photographer
    const { data: integracao, error: integracaoError } = await supabase
      .from('usuarios_integracoes')
      .select('provedor, dados_extras, access_token')
      .eq('user_id', gallery.user_id)
      .eq('status', 'ativo')
      .in('provedor', ['mercadopago', 'infinitepay'])
      .maybeSingle();

    if (integracaoError) {
      console.error('Integration fetch error:', integracaoError);
    }

    if (!integracao) {
      console.log(`No payment provider configured for user ${gallery.user_id}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Nenhum provedor de pagamento configurado',
          code: 'NO_PROVIDER'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📱 Payment provider: ${integracao.provedor} for user ${gallery.user_id}`);

    // 3. Normalize session_id to TEXT format (workflow-*) if available
    let sessionIdTexto: string | null = null;
    
    if (gallery.session_id) {
      // Check if it's already in workflow format
      if (gallery.session_id.startsWith('workflow-') || gallery.session_id.startsWith('session_')) {
        sessionIdTexto = gallery.session_id;
      } else {
        // Try to find the text session_id from clientes_sessoes
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

    // 5. Call the appropriate Edge Function based on provider
    const functionName = integracao.provedor === 'infinitepay' 
      ? 'infinitepay-create-link' 
      : 'mercadopago-create-link';

    console.log(`📞 Calling ${functionName} with:`, {
      clienteId: gallery.cliente_id,
      sessionId: sessionIdTexto,
      valor: valorTotal,
      descricao: cobrancaDescricao,
    });

    const { data: paymentData, error: paymentError } = await supabase.functions.invoke(functionName, {
      body: {
        clienteId: gallery.cliente_id,
        sessionId: sessionIdTexto,
        valor: valorTotal,
        descricao: cobrancaDescricao,
      }
    });

    if (paymentError) {
      console.error(`${functionName} error:`, paymentError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro ao criar cobrança: ${paymentError.message}`,
          code: 'PAYMENT_CREATE_ERROR'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!paymentData?.success) {
      console.error(`${functionName} returned error:`, paymentData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: paymentData?.error || 'Erro ao criar link de pagamento',
          code: 'PAYMENT_FAILED'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Extract checkout URL (different response formats)
    const checkoutUrl = integracao.provedor === 'infinitepay'
      ? paymentData.checkoutUrl
      : paymentData.paymentLink;

    const cobrancaId = integracao.provedor === 'infinitepay'
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

    console.log(`✅ Payment created: ${cobrancaId} via ${integracao.provedor}`);

    const response: PaymentResponse = {
      success: true,
      checkoutUrl,
      cobrancaId,
      provedor: integracao.provedor,
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
