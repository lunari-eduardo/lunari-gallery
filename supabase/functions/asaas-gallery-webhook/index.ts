import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ============================================================
    // VALIDAÇÃO DE TOKEN ASAAS
    // ============================================================
    const asaasWebhookToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN');
    if (!asaasWebhookToken) {
      console.warn('⚠️ ASAAS_WEBHOOK_TOKEN não configurado — validação de token desabilitada');
    } else {
      const receivedToken = req.headers.get('asaas-access-token');
      if (!receivedToken || receivedToken !== asaasWebhookToken) {
        console.error('❌ Token Asaas inválido ou ausente');
        return new Response(
          JSON.stringify({ error: 'Invalid webhook token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('✅ Token Asaas válido');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { event, payment } = body;

    console.log(`🔔 Asaas gallery webhook: event=${event}, paymentId=${payment?.id}`);

    if (!payment?.id) {
      return new Response(
        JSON.stringify({ received: true, message: 'No payment data' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only process payment confirmation events
    const confirmEvents = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'];
    if (!confirmEvents.includes(event)) {
      console.log(`⏭️ Ignoring event: ${event}`);
      return new Response(
        JSON.stringify({ received: true, message: `Event ${event} ignored` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the cobrança by Asaas payment ID (stored in mp_payment_id)
    const { data: cobranca, error: cobrancaError } = await supabase
      .from('cobrancas')
      .select('*')
      .eq('mp_payment_id', payment.id)
      .eq('provedor', 'asaas')
      .maybeSingle();

    if (cobrancaError) {
      console.error('Error finding cobrança:', cobrancaError);
      return new Response(
        JSON.stringify({ received: true, error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!cobranca) {
      console.warn(`⚠️ No cobrança found for Asaas payment ${payment.id}`);
      return new Response(
        JSON.stringify({ received: true, message: 'Cobrança not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Skip if already paid (idempotent)
    if (cobranca.status === 'pago') {
      console.log(`⏭️ Cobrança ${cobranca.id} already paid, skipping`);
      return new Response(
        JSON.stringify({ received: true, message: 'Already processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`💰 Processing payment confirmation for cobrança ${cobranca.id}`);

    // 1. Update cobrança to paid
    await supabase
      .from('cobrancas')
      .update({
        status: 'pago',
        data_pagamento: new Date().toISOString(),
      })
      .eq('id', cobranca.id);

    // 2. Update gallery if linked
    if (cobranca.galeria_id) {
      const { data: galeria } = await supabase
        .from('galerias')
        .select('id, total_fotos_extras_vendidas, valor_total_vendido')
        .eq('id', cobranca.galeria_id)
        .maybeSingle();

      if (galeria) {
        const extrasAtuais = galeria.total_fotos_extras_vendidas || 0;
        const extrasNovas = cobranca.qtd_fotos || 0;
        const valorAtual = Number(galeria.valor_total_vendido) || 0;
        const valorCobranca = Number(cobranca.valor) || 0;

        await supabase
          .from('galerias')
          .update({
            total_fotos_extras_vendidas: extrasAtuais + extrasNovas,
            valor_total_vendido: valorAtual + valorCobranca,
            status_pagamento: 'pago',
            status_selecao: 'selecao_completa',
            finalized_at: new Date().toISOString(),
          })
          .eq('id', cobranca.galeria_id);

        console.log(`✅ Gallery ${cobranca.galeria_id} finalized`);
      }
    }

    // 3. Update session if linked
    if (cobranca.session_id) {
      const { data: sessao } = await supabase
        .from('clientes_sessoes')
        .select('valor_pago')
        .eq('session_id', cobranca.session_id)
        .maybeSingle();

      if (sessao) {
        const valorAtual = Number(sessao.valor_pago) || 0;
        const valorCobranca = Number(cobranca.valor) || 0;

        await supabase
          .from('clientes_sessoes')
          .update({
            valor_pago: valorAtual + valorCobranca,
            status_galeria: 'selecao_completa',
            updated_at: new Date().toISOString(),
          })
          .eq('session_id', cobranca.session_id);

        console.log(`✅ Session ${cobranca.session_id} updated`);
      }
    }

    // 4. Log action
    if (cobranca.galeria_id) {
      await supabase.from('galeria_acoes').insert({
        galeria_id: cobranca.galeria_id,
        tipo: 'pagamento_confirmado',
        descricao: `Pagamento de R$ ${Number(cobranca.valor).toFixed(2)} confirmado via Asaas`,
        user_id: null,
      });
    }

    console.log(`✅ Asaas webhook processed: cobrança ${cobranca.id} marked as paid`);

    return new Response(
      JSON.stringify({ received: true, processed: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Asaas gallery webhook error:', error);
    return new Response(
      JSON.stringify({ received: true, error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
