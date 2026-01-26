import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  cobrancaId?: string;
  orderNsu?: string;
  sessionId?: string;
  forceUpdate?: boolean;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();
    const { cobrancaId, orderNsu, sessionId, forceUpdate } = body;

    console.log('🔍 Verificando status de pagamento:', { cobrancaId, orderNsu, sessionId, forceUpdate });

    // Find the charge
    let query = supabase.from('cobrancas').select('*');
    
    if (cobrancaId) {
      query = query.eq('id', cobrancaId);
    } else if (orderNsu) {
      query = query.eq('ip_order_nsu', orderNsu);
    } else if (sessionId) {
      query = query.eq('session_id', sessionId);
    } else {
      return new Response(
        JSON.stringify({ error: 'Informe cobrancaId, orderNsu ou sessionId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: cobranca, error: cobrancaError } = await query.maybeSingle();

    if (cobrancaError) {
      console.error('❌ Erro ao buscar cobrança:', cobrancaError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar cobrança', details: cobrancaError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!cobranca) {
      return new Response(
        JSON.stringify({ found: false, message: 'Cobrança não encontrada' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📋 Cobrança encontrada:', { 
      id: cobranca.id, 
      status: cobranca.status, 
      provedor: cobranca.provedor,
      valor: cobranca.valor 
    });

    // If already paid, just return the status
    if (cobranca.status === 'pago') {
      return new Response(
        JSON.stringify({
          found: true,
          status: 'pago',
          cobranca: {
            id: cobranca.id,
            status: cobranca.status,
            valor: cobranca.valor,
            provedor: cobranca.provedor,
            dataPagamento: cobranca.data_pagamento,
            receiptUrl: cobranca.ip_receipt_url,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If forceUpdate is true and status is pending, manually mark as paid
    // This is useful for manual reconciliation of payments that the webhook missed
    if (forceUpdate && cobranca.status === 'pendente') {
      console.log('⚡ Forçando atualização para pago');

      // Update cobranca
      const { error: updateCobrancaError } = await supabase
        .from('cobrancas')
        .update({
          status: 'pago',
          data_pagamento: new Date().toISOString(),
        })
        .eq('id', cobranca.id);

      if (updateCobrancaError) {
        console.error('❌ Erro ao atualizar cobrança:', updateCobrancaError);
        return new Response(
          JSON.stringify({ error: 'Erro ao atualizar cobrança', details: updateCobrancaError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('✅ Cobrança atualizada para pago');

      // Update gallery payment status if session_id exists
      if (cobranca.session_id) {
        const { data: galeria } = await supabase
          .from('galerias')
          .select('id')
          .eq('session_id', cobranca.session_id)
          .maybeSingle();

        if (galeria) {
          await supabase
            .from('galerias')
            .update({ status_pagamento: 'pago' })
            .eq('id', galeria.id);
          console.log('✅ Galeria atualizada para pago');
        }

        // Update clientes_sessoes.valor_pago
        const { data: sessao } = await supabase
          .from('clientes_sessoes')
          .select('valor_pago')
          .eq('session_id', cobranca.session_id)
          .maybeSingle();

        if (sessao) {
          const valorAtual = Number(sessao.valor_pago) || 0;
          const valorCobranca = Number(cobranca.valor) || 0;
          const novoValorPago = valorAtual + valorCobranca;

          await supabase
            .from('clientes_sessoes')
            .update({ valor_pago: novoValorPago })
            .eq('session_id', cobranca.session_id);
          console.log(`✅ Sessão valor_pago atualizado: ${valorAtual} + ${valorCobranca} = ${novoValorPago}`);
        }
      }

      return new Response(
        JSON.stringify({
          found: true,
          status: 'pago',
          updated: true,
          message: 'Pagamento confirmado manualmente',
          cobranca: {
            id: cobranca.id,
            status: 'pago',
            valor: cobranca.valor,
            provedor: cobranca.provedor,
            dataPagamento: new Date().toISOString(),
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return current status without modification
    return new Response(
      JSON.stringify({
        found: true,
        status: cobranca.status,
        cobranca: {
          id: cobranca.id,
          status: cobranca.status,
          valor: cobranca.valor,
          provedor: cobranca.provedor,
          checkoutUrl: cobranca.ip_checkout_url,
          orderNsu: cobranca.ip_order_nsu,
          createdAt: cobranca.created_at,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Erro interno:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
