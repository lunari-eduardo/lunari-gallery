// supabase/functions/_shared/payment-processor.ts

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export interface PaymentInfo {
  provider: 'asaas' | 'mercadopago';
  externalId: string;
  installmentId?: string;
  installmentNumber: number;
  totalInstallments: number;
  value: number;
  netValue: number;
  billingType: string;
  paymentDate?: string;
  dueDate?: string;
}

/**
 * Unifica a lógica de processamento de pagamentos de galeria.
 * Garante que parcelas sejam registradas e a RPC de finalização seja chamada.
 */
export async function processGalleryPayment(
  supabase: SupabaseClient,
  payment: PaymentInfo
) {
  console.log(`[Processor] Processando pagamento de galeria: ${payment.externalId}, provider: ${payment.provider}`);

  // 1. Localizar cobrança
  let cobranca = null;

  if (payment.installmentId && payment.provider === 'asaas') {
    const { data } = await supabase
      .from("cobrancas")
      .select("*")
      .eq("asaas_installment_id", payment.installmentId)
      .eq("provedor", "asaas")
      .maybeSingle();
    cobranca = data;
  }

  if (!cobranca) {
    const field = payment.provider === 'asaas' ? 'id' : 'mp_payment_id'; // Asaas usa ID direto na cobranca se não for parcelado
    // Na verdade, no Asaas o payment.id do webhook é o ID da cobrança se não houver installments.
    // Mas no Mercado Pago, o mp_payment_id é o que salvamos.
    
    // Melhor tentar buscar por ID externo (mp_payment_id ou ID de referência externa)
    const { data } = await supabase
      .from("cobrancas")
      .select("*")
      .or(`id.eq.${payment.externalId},mp_payment_id.eq.${payment.externalId}`)
      .maybeSingle();
    cobranca = data;
  }

  if (!cobranca) {
    console.warn(`[Processor] ⚠️ Nenhuma cobrança encontrada para payment ${payment.externalId}`);
    return { success: false, error: 'Cobranca nao encontrada' };
  }

  // 2. Registrar parcela
  const valorBruto = payment.value;
  const netValue = payment.netValue;
  const taxaGateway = Math.round((valorBruto - netValue) * 100) / 100;
  const billingType = payment.billingType.toLowerCase();

  const upsertData: any = {
    cobranca_id: cobranca.id,
    numero_parcela: payment.installmentNumber,
    valor_bruto: valorBruto,
    valor_liquido: netValue,
    taxa_gateway: taxaGateway >= 0 ? taxaGateway : 0,
    status: 'confirmado',
    billing_type: billingType.includes('card') ? 'card' : billingType,
    data_pagamento: payment.paymentDate || new Date().toISOString(),
    data_vencimento: payment.dueDate || null,
  };

  if (payment.provider === 'asaas') {
    upsertData.asaas_payment_id = payment.externalId;
  } else {
    upsertData.mp_payment_id = payment.externalId;
  }

  const conflictColumn = payment.provider === 'asaas' ? 'asaas_payment_id' : 'mp_payment_id';

  const { error: parcelaError } = await supabase
    .from("cobranca_parcelas")
    .upsert(upsertData, { onConflict: conflictColumn });

  if (parcelaError) {
    console.error(`[Processor] ❌ Erro ao upsert parcela:`, parcelaError);
    return { success: false, error: parcelaError.message };
  }

  console.log(`[Processor] ✅ Parcela ${payment.installmentNumber} registrada para cobrança ${cobranca.id}`);

  // 3. Atualizar valor_liquido total na cobranca
  const { data: parcelasSum } = await supabase
    .from("cobranca_parcelas")
    .select("valor_liquido")
    .eq("cobranca_id", cobranca.id)
    .eq("status", "confirmado");

  if (parcelasSum && parcelasSum.length > 0) {
    const totalLiquido = parcelasSum.reduce((sum: number, p: any) => sum + (Number(p.valor_liquido) || 0), 0);
    const roundedLiquido = Math.round(totalLiquido * 100) / 100;
    await supabase
      .from("cobrancas")
      .update({ valor_liquido: roundedLiquido })
      .eq("id", cobranca.id);
  }

  // 4. Verificar se deve finalizar (se todas as parcelas foram pagas ou se é pagamento único)
  // Re-checar status via banco para ver se o trigger de parcelas já atualizou a cobranca para 'pago'
  const { data: refreshed } = await supabase
    .from("cobrancas")
    .select("status, galeria_id, user_id, valor")
    .eq("id", cobranca.id)
    .single();

  if (refreshed && refreshed.status === 'pago') {
    console.log(`[Processor] ✅ Cobrança ${cobranca.id} está paga — chamando finalize_gallery_payment`);

    const { data: rpcResult, error: rpcError } = await supabase.rpc('finalize_gallery_payment', {
      p_cobranca_id: cobranca.id,
      p_receipt_url: null,
      p_paid_at: payment.paymentDate || new Date().toISOString(),
    });

    if (rpcError) {
      console.error('[Processor] ❌ RPC finalize_gallery_payment error:', rpcError);
      return { success: false, error: rpcError.message };
    }

    // Notificação de e-mail (usando fetch interno para a edge function)
    await notifyPaymentConfirmed(supabase, cobranca.id);

    // Log de ação na galeria
    if (refreshed.galeria_id) {
      await supabase.from("galeria_acoes").insert({
        galeria_id: refreshed.galeria_id,
        tipo: "pagamento_confirmado",
        descricao: `Pagamento (R$ ${refreshed.valor.toFixed(2)}) confirmado via ${payment.provider}`,
        user_id: null,
      });
    }

    return { success: true, finalized: true, result: rpcResult };
  }

  return { success: true, finalized: false };
}

/**
 * Notifica a finalização do pagamento via e-mail.
 */
async function notifyPaymentConfirmed(supabase: SupabaseClient, cobrancaId: string) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: 'payment_confirmed', paymentId: cobrancaId }),
    });
    
    if (!response.ok) {
      console.warn('[Processor] ⚠️ payment email notification failed:', response.status);
    }
  } catch (error) {
    console.warn('[Processor] ⚠️ payment email notification exception:', error);
  }
}

/**
 * Processa compra de créditos (Mercado Pago).
 */
export async function processCreditPurchase(
  supabase: SupabaseClient,
  purchase: any,
  mpPayment: any
) {
  console.log(`[Processor] Processando compra de créditos: ${purchase.id}`);
  
  if (purchase.status === 'approved') {
    return { success: true, already_processed: true };
  }

  const updateData: any = {
    mp_payment_id: String(mpPayment.id),
    mp_status: mpPayment.status,
    metadata: {
      ...((purchase.metadata as Record<string, unknown>) || {}),
      webhook_update: {
        status: mpPayment.status,
        status_detail: mpPayment.status_detail,
        updated_at: new Date().toISOString(),
      }
    }
  };

  if (mpPayment.status === 'approved') {
    updateData.status = 'approved';
    updateData.paid_at = mpPayment.date_approved || new Date().toISOString();

    const { data: ledgerId, error: creditError } = await supabase.rpc('purchase_credits', {
      _user_id: purchase.user_id,
      _amount: purchase.credits_amount,
      _purchase_id: purchase.id,
      _description: `Compra de ${purchase.credits_amount.toLocaleString('pt-BR')} créditos via Mercado Pago`,
    });

    if (creditError) {
      console.error('[Processor] Erro ao adicionar créditos:', creditError);
      return { success: false, error: creditError.message };
    }

    updateData.ledger_id = ledgerId;

    // Referral bonus
    try {
      await supabase.rpc('grant_referral_select_bonus', {
        _referred_user_id: purchase.user_id,
      });
    } catch (e) {
      console.warn('[Processor] Referral bonus exception (non-fatal):', e);
    }
  } else if (mpPayment.status === 'rejected' || mpPayment.status === 'cancelled') {
    updateData.status = mpPayment.status;
  }

  const { error: updateError } = await supabase
    .from('credit_purchases')
    .update(updateData)
    .eq('id', purchase.id);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  return { success: true, status: updateData.status };
}
