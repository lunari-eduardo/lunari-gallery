/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  CONTRATO COMPARTILHADO — NÃO MODIFICAR SEM COORDENAÇÃO    ║
 * ║                                                              ║
 * ║  Webhook Asaas para pagamentos de galeria (fotos extras).    ║
 * ║                                                              ║
 * ║  Fluxo:                                                      ║
 * ║  1. Validar token Asaas                                      ║
 * ║  2. Encontrar cobrança por mp_payment_id                     ║
 * ║  3. Extrair netValue e calcular taxa_gateway                 ║
 * ║  4. Upsert cobranca_parcelas (trigger reconcile dispara)     ║
 * ║  5. Chamar RPC finalize_gallery_payment (sincroniza galeria) ║
 * ║  6. Log de ação                                              ║
 * ║                                                              ║
 * ║  Cadeia de triggers:                                         ║
 * ║  upsert parcela → reconcile_cobranca_from_parcelas           ║
 * ║    → UPDATE cobrancas.status='pago'                          ║
 * ║      → ensure_transaction_on_cobranca_paid                   ║
 * ║        → INSERT clientes_transacoes                          ║
 * ║          → trigger_recompute_session_paid                    ║
 * ║      → sync_gallery_on_cobranca_paid                         ║
 * ║                                                              ║
 * ║  Projetos: Gallery (Select) + Gestão                         ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
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

    console.log(`🔔 Asaas gallery webhook: event=${event}, paymentId=${payment?.id}, status=${payment?.status}`);

    if (!payment?.id) {
      return new Response(
        JSON.stringify({ received: true, message: 'No payment data' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only process payment confirmation events
    const confirmEvents = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_ANTICIPATED'];
    if (!confirmEvents.includes(event)) {
      console.log(`⏭️ Ignoring event: ${event}`);
      return new Response(
        JSON.stringify({ received: true, message: `Event ${event} ignored` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================
    // 1. ENCONTRAR COBRANÇA
    // ============================================================
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

    // Fallback: try by installment ID if payment not found directly
    if (!cobranca && payment.installment) {
      const { data: cobrancaByInstallment } = await supabase
        .from('cobrancas')
        .select('*')
        .eq('asaas_installment_id', payment.installment)
        .eq('provedor', 'asaas')
        .maybeSingle();

      if (cobrancaByInstallment) {
        console.log(`📋 Found cobrança by installment ID: ${payment.installment}`);
        // Continue with this cobrança
        return await processPayment(supabase, cobrancaByInstallment, payment, event);
      }
    }

    if (!cobranca) {
      console.warn(`⚠️ No cobrança found for Asaas payment ${payment.id}`);
      return new Response(
        JSON.stringify({ received: true, message: 'Cobrança not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return await processPayment(supabase, cobranca, payment, event);

  } catch (error) {
    console.error('Asaas gallery webhook error:', error);
    return new Response(
      JSON.stringify({ received: true, error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processPayment(
  supabase: ReturnType<typeof createClient>,
  cobranca: Record<string, unknown>,
  payment: Record<string, unknown>,
  event: string,
) {
  const cobrancaId = cobranca.id as string;

  // Skip if already paid (idempotent)
  if (cobranca.status === 'pago' || cobranca.status === 'pago_manual') {
    console.log(`⏭️ Cobrança ${cobrancaId} already paid (${cobranca.status}), skipping`);
    return new Response(
      JSON.stringify({ received: true, message: 'Already processed' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  console.log(`💰 Processing payment confirmation for cobrança ${cobrancaId}`);

  // ============================================================
  // 2. EXTRAIR TAXAS E VALORES LÍQUIDOS
  // ============================================================
  const valorBruto = Number(payment.value) || Number(cobranca.valor) || 0;
  const netValue = Number(payment.netValue) || valorBruto;
  const taxaGateway = Math.round((valorBruto - netValue) * 100) / 100;

  console.log(`📊 Valores: bruto=R$${valorBruto}, líquido=R$${netValue}, taxa=R$${taxaGateway}`);

  // ============================================================
  // 3. UPSERT COBRANCA_PARCELAS
  // ============================================================
  // Determine parcela number from payment data
  const installmentNumber = payment.installmentNumber || 1;
  const billingType = (payment.billingType as string) || 'CREDIT_CARD';
  const isAnticipated = event === 'PAYMENT_ANTICIPATED';

  // Map Asaas billing type to our format
  const billingTypeMap: Record<string, string> = {
    'CREDIT_CARD': 'card',
    'PIX': 'pix',
    'BOLETO': 'link',
    'UNDEFINED': 'card',
  };
  const mappedBillingType = billingTypeMap[billingType] || 'card';

  const parcelaData = {
    cobranca_id: cobrancaId,
    asaas_payment_id: payment.id as string,
    numero_parcela: installmentNumber as number,
    valor_bruto: valorBruto,
    valor_liquido: netValue,
    taxa_gateway: taxaGateway,
    taxa_antecipacao: isAnticipated ? taxaGateway : 0,
    status: 'confirmado',
    billing_type: mappedBillingType,
    data_pagamento: payment.paymentDate || payment.confirmedDate || new Date().toISOString().split('T')[0],
    data_credito: payment.creditDate || null,
    antecipado: isAnticipated,
    updated_at: new Date().toISOString(),
  };

  console.log(`📝 Upserting cobranca_parcela: parcela ${installmentNumber}, asaas_id=${payment.id}`);

  const { error: parcelaError } = await supabase
    .from('cobranca_parcelas')
    .upsert(parcelaData, { onConflict: 'asaas_payment_id' });

  if (parcelaError) {
    console.error('❌ Error upserting cobranca_parcela:', parcelaError);
    // Don't fail — continue with RPC fallback
  } else {
    console.log(`✅ cobranca_parcela upserted (trigger reconcile_cobranca_from_parcelas will fire)`);
  }

  // ============================================================
  // 4. ATUALIZAR VALOR_LIQUIDO NA COBRANÇA
  // ============================================================
  const { error: updateError } = await supabase
    .from('cobrancas')
    .update({
      valor_liquido: netValue,
      updated_at: new Date().toISOString(),
    })
    .eq('id', cobrancaId);

  if (updateError) {
    console.warn('⚠️ Error updating cobranca valor_liquido:', updateError);
  }

  // ============================================================
  // 5. CHAMAR RPC PARA SINCRONIZAR GALERIA/SESSÃO
  // ============================================================
  // A RPC finalize_gallery_payment sincroniza:
  // - galerias.status_pagamento
  // - galerias.finalized_at
  // - clientes_sessoes.status_galeria / status_pagamento_fotos_extra
  // Nota: se o trigger reconcile já mudou status para 'pago', a RPC detectará "already paid"
  // e fará auto-heal da galeria/sessão se necessário.

  const receiptUrl = (payment as Record<string, unknown>).transactionReceiptUrl as string || null;

  const { data: rpcResult, error: rpcError } = await supabase.rpc('finalize_gallery_payment', {
    p_cobranca_id: cobrancaId,
    p_receipt_url: receiptUrl,
    p_paid_at: new Date().toISOString(),
  });

  if (rpcError) {
    console.error('❌ RPC finalize_gallery_payment error:', rpcError);
    // Don't return error — the trigger chain may have already done the work
  } else {
    console.log('✅ finalize_gallery_payment result:', JSON.stringify(rpcResult));
  }

  // ============================================================
  // 6. LOG DE AÇÃO
  // ============================================================
  const galeriaId = cobranca.galeria_id as string | null;
  if (galeriaId) {
    await supabase.from('galeria_acoes').insert({
      galeria_id: galeriaId,
      tipo: 'pagamento_confirmado',
      descricao: `Pagamento de R$ ${valorBruto.toFixed(2)} confirmado via Asaas (líquido: R$ ${netValue.toFixed(2)}, taxa: R$ ${taxaGateway.toFixed(2)})`,
      user_id: null,
    });
  }

  console.log(`✅ Asaas webhook processed: cobrança ${cobrancaId} — event=${event}`);

  return new Response(
    JSON.stringify({ received: true, processed: true }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}
