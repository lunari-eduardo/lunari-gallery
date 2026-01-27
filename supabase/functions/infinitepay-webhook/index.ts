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

  // Initialize Supabase client early for logging
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Capture headers for audit log
  const headersObject: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headersObject[key] = value;
  });

  let rawBody = '';
  let payload: InfinitePayWebhookPayload | null = null;
  let orderNsu: string | null = null;
  let initialLogId: string | null = null;

  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      console.log('❌ Method not allowed:', req.method);
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Read raw body
    rawBody = await req.text();
    
    // ============================================================
    // REGRA 3.1.2: LOG IMEDIATO - Antes de qualquer processamento
    // ============================================================
    console.log('📥 WEBHOOK RECEIVED - Headers:', JSON.stringify(headersObject));
    console.log('📥 WEBHOOK RECEIVED - Body:', rawBody);
    
    const { data: initialLog, error: initialLogError } = await supabase
      .from('webhook_logs')
      .insert({
        provedor: 'infinitepay',
        payload: { raw: rawBody },
        headers: headersObject,
        status: 'received_raw',
        order_nsu: null,
      })
      .select('id')
      .single();

    if (initialLogError) {
      console.error('⚠️ Falha ao registrar log inicial:', initialLogError.message);
    } else {
      initialLogId = initialLog?.id;
      console.log('📝 Log inicial registrado:', initialLogId);
    }
    
    // Parse webhook payload
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error('❌ Failed to parse webhook body as JSON');
      
      // Update initial log with parse error status
      if (initialLogId) {
        await supabase.from('webhook_logs')
          .update({
            status: 'parse_error',
            error_message: 'Invalid JSON body',
            processed_at: new Date().toISOString(),
          })
          .eq('id', initialLogId);
      }
      
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📥 InfinitePay webhook parsed:', JSON.stringify(payload, null, 2));

    // Extract order_nsu for tracking
    orderNsu = payload?.order_nsu || null;

    // Update initial log with parsed payload and order_nsu
    if (initialLogId) {
      await supabase.from('webhook_logs')
        .update({
          payload: payload,
          order_nsu: orderNsu,
          status: 'received',
        })
        .eq('id', initialLogId);
      console.log('📝 Log atualizado com payload parseado');
    }

    // Validate required fields
    if (!orderNsu) {
      console.error('❌ Missing order_nsu in webhook payload');
      
      if (initialLogId) {
        await supabase.from('webhook_logs')
          .update({ 
            status: 'error', 
            error_message: 'Missing order_nsu',
            processed_at: new Date().toISOString()
          })
          .eq('id', initialLogId);
      }
      
      return new Response(
        JSON.stringify({ error: 'Missing order_nsu' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================
    // REGRA 3.1.4: ORDEM DE BUSCA FIXA
    // 1º: Buscar por ip_order_nsu = order_nsu
    // 2º: Fallback por id = order_nsu (UUID)
    // ============================================================
    
    let cobranca = null;
    let cobrancaError = null;
    let foundBy: 'ip_order_nsu' | 'id' | null = null;

    // PASSO 1: Buscar por ip_order_nsu
    console.log('🔍 PASSO 1: Buscando cobrança por ip_order_nsu:', orderNsu);
    const { data: cobrancaByNsu, error: nsuError } = await supabase
      .from('cobrancas')
      .select('*')
      .eq('ip_order_nsu', orderNsu)
      .maybeSingle();

    if (nsuError) {
      console.error('❌ Error fetching cobranca by ip_order_nsu:', nsuError);
      cobrancaError = nsuError;
    } else if (cobrancaByNsu) {
      cobranca = cobrancaByNsu;
      foundBy = 'ip_order_nsu';
      console.log('✅ Cobrança encontrada por ip_order_nsu');
    }

    // PASSO 2: Fallback - Buscar por id (UUID)
    if (!cobranca && !cobrancaError) {
      console.log('🔄 PASSO 2: Cobrança não encontrada por ip_order_nsu, tentando por id (UUID)...');
      const { data: cobrancaById, error: idError } = await supabase
        .from('cobrancas')
        .select('*')
        .eq('id', orderNsu)
        .maybeSingle();

      if (idError) {
        console.error('❌ Error fetching cobranca by id:', idError);
        cobrancaError = idError;
      } else if (cobrancaById) {
        cobranca = cobrancaById;
        foundBy = 'id';
        console.log('✅ Cobrança encontrada por id (UUID)');
      }
    }

    if (cobrancaError) {
      console.error('❌ Error fetching cobranca:', cobrancaError);
      
      if (initialLogId) {
        await supabase.from('webhook_logs')
          .update({ 
            status: 'error', 
            error_message: `DB error: ${cobrancaError.message}`,
            processed_at: new Date().toISOString()
          })
          .eq('id', initialLogId);
      }
      
      return new Response(
        JSON.stringify({ error: 'Database error', details: cobrancaError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!cobranca) {
      console.warn('⚠️ Cobrança não encontrada para order_nsu:', orderNsu);
      
      if (initialLogId) {
        await supabase.from('webhook_logs')
          .update({ 
            status: 'ignored', 
            error_message: 'Cobranca not found (searched by ip_order_nsu and id)',
            processed_at: new Date().toISOString()
          })
          .eq('id', initialLogId);
      }
      
      // Return 200 to prevent InfinitePay from retrying for non-existent orders
      return new Response(
        JSON.stringify({ success: true, message: 'Cobranca not found, ignoring' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`💳 Cobrança encontrada por ${foundBy}:`, cobranca.id);

    // Check if already processed
    if (cobranca.status === 'pago') {
      console.log('ℹ️ Payment already processed for order_nsu:', orderNsu);
      
      if (initialLogId) {
        await supabase.from('webhook_logs')
          .update({ 
            status: 'already_processed', 
            processed_at: new Date().toISOString()
          })
          .eq('id', initialLogId);
      }
      
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
        ip_transaction_nsu: payload?.transaction_nsu || null,
        ip_receipt_url: payload?.receipt_url || null,
      })
      .eq('id', cobranca.id);

    if (updateCobrancaError) {
      console.error('❌ Error updating cobranca:', updateCobrancaError);
      
      if (initialLogId) {
        await supabase.from('webhook_logs')
          .update({ 
            status: 'error', 
            error_message: `Cobranca update failed: ${updateCobrancaError.message}`,
            processed_at: new Date().toISOString()
          })
          .eq('id', initialLogId);
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to update cobranca', details: updateCobrancaError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Cobranca updated to paid');

    // CREDIT SYSTEM: Increment total_fotos_extras_vendidas on gallery if galeria_id exists
    if (cobranca.galeria_id && cobranca.qtd_fotos) {
      const { data: galeria, error: galeriaExtrasError } = await supabase
        .from('galerias')
        .select('id, total_fotos_extras_vendidas, valor_total_vendido')
        .eq('id', cobranca.galeria_id)
        .maybeSingle();

      if (galeriaExtrasError) {
        console.error('❌ Error fetching galeria for extras update:', galeriaExtrasError);
      } else if (galeria) {
        const extrasAtuais = galeria.total_fotos_extras_vendidas || 0;
        const extrasNovas = cobranca.qtd_fotos || 0;
        const valorAtual = Number(galeria.valor_total_vendido) || 0;
        const valorCobranca = Number(cobranca.valor) || 0;

        const { error: updateExtrasError } = await supabase
          .from('galerias')
          .update({
            total_fotos_extras_vendidas: extrasAtuais + extrasNovas,
            valor_total_vendido: valorAtual + valorCobranca,
            status_pagamento: 'pago',
          })
          .eq('id', cobranca.galeria_id);

        if (updateExtrasError) {
          console.error('❌ Error updating galeria extras:', updateExtrasError);
        } else {
          console.log(`✅ Galeria extras updated: ${extrasAtuais} + ${extrasNovas} = ${extrasAtuais + extrasNovas}`);
        }
      }
    }
    // Fallback: Update gallery payment status if session_id exists (legacy flow)
    else if (cobranca.session_id) {
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
    }

    // Update clientes_sessoes.valor_pago if session_id exists
    if (cobranca.session_id) {
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

    // Update webhook log to success
    if (initialLogId) {
      await supabase.from('webhook_logs')
        .update({ 
          status: 'processed', 
          processed_at: new Date().toISOString()
        })
        .eq('id', initialLogId);
    }

    console.log('🎉 Webhook processed successfully for order_nsu:', orderNsu, `(found by ${foundBy})`);

    return new Response(
      JSON.stringify({ success: true, message: 'Payment processed', foundBy }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Webhook error:', error);
    
    // Try to update existing log or create new one
    try {
      if (initialLogId) {
        await supabase.from('webhook_logs')
          .update({
            status: 'exception',
            error_message: errorMessage,
            processed_at: new Date().toISOString(),
          })
          .eq('id', initialLogId);
      } else {
        await supabase.from('webhook_logs').insert({
          provedor: 'infinitepay',
          payload: payload || { raw: rawBody },
          headers: headersObject,
          status: 'exception',
          order_nsu: orderNsu,
          error_message: errorMessage,
        });
      }
    } catch (logErr) {
      console.error('❌ Failed to log exception:', logErr);
    }
    
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
