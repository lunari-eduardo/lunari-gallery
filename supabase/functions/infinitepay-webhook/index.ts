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

    // ============================================================
    // VALIDAÇÃO DE ASSINATURA - HMAC-SHA256
    // ============================================================
    const webhookSecret = Deno.env.get('INFINITEPAY_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.warn('⚠️ INFINITEPAY_WEBHOOK_SECRET não configurado — validação de assinatura desabilitada');
    } else {
      const receivedSignature = req.headers.get('x-infinia-signature') || req.headers.get('X-Infinia-Signature');
      if (!receivedSignature) {
        console.error('❌ Header x-infinia-signature ausente');
        if (initialLogId) {
          await supabase.from('webhook_logs').update({
            status: 'signature_invalid',
            error_message: 'Missing x-infinia-signature header',
            processed_at: new Date().toISOString(),
          }).eq('id', initialLogId);
        }
        return new Response(
          JSON.stringify({ error: 'Missing signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Compute HMAC-SHA256
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw', encoder.encode(webhookSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
      const computedSignature = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0')).join('');

      // Timing-safe comparison
      const sigA = encoder.encode(computedSignature);
      const sigB = encoder.encode(receivedSignature.toLowerCase());
      const isValid = sigA.length === sigB.length && crypto.subtle.timingSafeEqual
        ? (() => { try { return crypto.subtle.timingSafeEqual(sigA, sigB); } catch { return computedSignature === receivedSignature.toLowerCase(); } })()
        : computedSignature === receivedSignature.toLowerCase();

      if (!isValid) {
        console.error('❌ Assinatura HMAC inválida');
        if (initialLogId) {
          await supabase.from('webhook_logs').update({
            status: 'signature_invalid',
            error_message: 'Invalid HMAC signature',
            processed_at: new Date().toISOString(),
          }).eq('id', initialLogId);
        }
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('✅ Assinatura HMAC válida');
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

    // Save InfinitePay-specific fields before RPC
    if (payload?.transaction_nsu || payload?.receipt_url) {
      await supabase
        .from('cobrancas')
        .update({
          ip_transaction_nsu: payload?.transaction_nsu || null,
        })
        .eq('id', cobranca.id);
    }

    // Call centralized RPC for atomic payment finalization
    const { data: rpcResult, error: rpcError } = await supabase.rpc('finalize_gallery_payment', {
      p_cobranca_id: cobranca.id,
      p_receipt_url: payload?.receipt_url || null,
      p_paid_at: new Date().toISOString(),
    });

    if (rpcError) {
      console.error('❌ RPC finalize_gallery_payment error:', rpcError);
      
      if (initialLogId) {
        await supabase.from('webhook_logs')
          .update({ 
            status: 'error', 
            error_message: `RPC error: ${rpcError.message}`,
            processed_at: new Date().toISOString()
          })
          .eq('id', initialLogId);
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to finalize payment', details: rpcError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ finalize_gallery_payment result:', JSON.stringify(rpcResult));

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
