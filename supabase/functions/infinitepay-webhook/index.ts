import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InfinitePayWebhookPayload {
  invoice_slug?: string;
  amount?: number;
  paid_amount?: number;
  installments?: number;
  capture_method?: string;
  transaction_nsu?: string;
  order_nsu?: string;
  receipt_url?: string;
  items?: Array<{
    description?: string;
    quantity?: number;
    amount?: number;
  }>;
  status?: string;
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

    // Parse webhook payload
    const payload: InfinitePayWebhookPayload = await req.json();
    console.log('📥 InfinitePay webhook received:', JSON.stringify(payload, null, 2));

    // Validate required fields
    const orderNsu = payload.order_nsu;
    if (!orderNsu) {
      console.error('❌ Missing order_nsu in webhook payload');
      return new Response(
        JSON.stringify({ error: 'Missing order_nsu' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the charge by order_nsu
    const { data: cobranca, error: cobrancaError } = await supabase
      .from('cobrancas')
      .select('*')
      .eq('ip_order_nsu', orderNsu)
      .maybeSingle();

    if (cobrancaError) {
      console.error('❌ Error fetching cobranca:', cobrancaError);
      return new Response(
        JSON.stringify({ error: 'Database error', details: cobrancaError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!cobranca) {
      console.warn('⚠️ Cobranca not found for order_nsu:', orderNsu);
      // Return 200 to prevent InfinitePay from retrying for non-existent orders
      return new Response(
        JSON.stringify({ success: true, message: 'Cobranca not found, ignoring' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already processed
    if (cobranca.status === 'pago') {
      console.log('ℹ️ Payment already processed for order_nsu:', orderNsu);
      return new Response(
        JSON.stringify({ success: true, message: 'Already processed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('💳 Processing payment for cobranca:', cobranca.id);

    // Update cobranca to paid
    const { error: updateCobrancaError } = await supabase
      .from('cobrancas')
      .update({
        status: 'pago',
        data_pagamento: new Date().toISOString(),
        ip_transaction_nsu: payload.transaction_nsu || null,
        ip_receipt_url: payload.receipt_url || null,
      })
      .eq('id', cobranca.id);

    if (updateCobrancaError) {
      console.error('❌ Error updating cobranca:', updateCobrancaError);
      return new Response(
        JSON.stringify({ error: 'Failed to update cobranca', details: updateCobrancaError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Cobranca updated to paid');

    // Update gallery payment status if session_id exists
    if (cobranca.session_id) {
      // Find gallery by session_id
      const { data: galeria, error: galeriaError } = await supabase
        .from('galerias')
        .select('id')
        .eq('session_id', cobranca.session_id)
        .maybeSingle();

      if (galeriaError) {
        console.error('❌ Error fetching galeria:', galeriaError);
      } else if (galeria) {
        // Update gallery payment status
        const { error: updateGaleriaError } = await supabase
          .from('galerias')
          .update({ status_pagamento: 'pago' })
          .eq('id', galeria.id);

        if (updateGaleriaError) {
          console.error('❌ Error updating galeria:', updateGaleriaError);
        } else {
          console.log('✅ Galeria payment status updated to pago');
        }
      }

      // Update clientes_sessoes.valor_pago
      const { data: sessao, error: sessaoError } = await supabase
        .from('clientes_sessoes')
        .select('valor_pago')
        .eq('session_id', cobranca.session_id)
        .maybeSingle();

      if (sessaoError) {
        console.error('❌ Error fetching sessao:', sessaoError);
      } else if (sessao) {
        const valorAtual = Number(sessao.valor_pago) || 0;
        const valorCobranca = Number(cobranca.valor) || 0;
        const novoValorPago = valorAtual + valorCobranca;

        const { error: updateSessaoError } = await supabase
          .from('clientes_sessoes')
          .update({ valor_pago: novoValorPago })
          .eq('session_id', cobranca.session_id);

        if (updateSessaoError) {
          console.error('❌ Error updating sessao valor_pago:', updateSessaoError);
        } else {
          console.log(`✅ Sessao valor_pago updated: ${valorAtual} + ${valorCobranca} = ${novoValorPago}`);
        }
      }
    }

    console.log('🎉 Webhook processed successfully for order_nsu:', orderNsu);

    return new Response(
      JSON.stringify({ success: true, message: 'Payment processed' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
