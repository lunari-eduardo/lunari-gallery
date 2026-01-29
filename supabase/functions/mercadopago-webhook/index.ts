import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookPayload {
  id?: number;
  live_mode?: boolean;
  type?: string;
  date_created?: string;
  user_id?: number;
  api_version?: string;
  action?: string;
  data?: {
    id?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');

  // Usar service role para acessar todas as compras
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Log imediato do payload antes de qualquer processamento
  let rawBody = '';
  try {
    rawBody = await req.text();
    
    // Logar webhook imediatamente
    const logResult = await supabase.from('webhook_logs').insert({
      source: 'mercadopago',
      event_type: 'incoming',
      payload: { raw: rawBody, headers: Object.fromEntries(req.headers.entries()) },
    });
    if (logResult.error) {
      console.error('Erro ao logar webhook:', logResult.error);
    }

  } catch (e) {
    console.error('Erro ao ler body:', e);
    return new Response('OK', { status: 200, headers: corsHeaders });
  }

  try {
    const payload: WebhookPayload = JSON.parse(rawBody);
    
    console.log('Webhook Mercado Pago recebido:', {
      type: payload.type,
      action: payload.action,
      data_id: payload.data?.id,
    });

    // Processar apenas eventos de pagamento
    // Eventos esperados: payment.created, payment.updated
    if (payload.type !== 'payment') {
      console.log('Ignorando evento não-payment:', payload.type);
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    const paymentId = payload.data?.id;
    if (!paymentId) {
      console.log('Webhook sem payment ID');
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    if (!mpAccessToken) {
      console.error('MERCADOPAGO_ACCESS_TOKEN não configurado');
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    // Buscar detalhes do pagamento na API do Mercado Pago
    console.log('Consultando pagamento no MP:', paymentId);
    
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
      },
    });

    if (!mpResponse.ok) {
      console.error('Erro ao consultar pagamento:', await mpResponse.text());
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    const mpPayment = await mpResponse.json();
    
    console.log('Pagamento MP:', {
      id: mpPayment.id,
      status: mpPayment.status,
      external_reference: mpPayment.external_reference,
    });

    // external_reference contém o ID da compra (purchase_id)
    const purchaseId = mpPayment.external_reference;
    if (!purchaseId) {
      console.log('Pagamento sem external_reference (não é compra de créditos)');
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    // Buscar compra no banco
    const { data: purchase, error: purchaseError } = await supabase
      .from('credit_purchases')
      .select('*')
      .eq('id', purchaseId)
      .single();

    if (purchaseError || !purchase) {
      console.error('Compra não encontrada:', purchaseId, purchaseError);
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    // Verificar idempotência - se já processado, ignorar
    if (purchase.status === 'approved') {
      console.log('Compra já aprovada, ignorando webhook');
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    // Atualizar status da compra
    const updateData: Record<string, unknown> = {
      mp_payment_id: String(mpPayment.id),
      mp_status: mpPayment.status,
      metadata: {
        ...purchase.metadata,
        webhook_update: {
          status: mpPayment.status,
          status_detail: mpPayment.status_detail,
          updated_at: new Date().toISOString(),
        }
      }
    };

    // Se aprovado, adicionar créditos
    if (mpPayment.status === 'approved') {
      updateData.status = 'approved';
      updateData.paid_at = mpPayment.date_approved || new Date().toISOString();

      console.log('Pagamento aprovado, adicionando créditos:', {
        user_id: purchase.user_id,
        credits: purchase.credits_amount,
      });

      // Chamar RPC para adicionar créditos
      const { data: ledgerId, error: creditError } = await supabase.rpc('purchase_credits', {
        _user_id: purchase.user_id,
        _amount: purchase.credits_amount,
        _purchase_id: purchase.id,
        _description: `Compra de ${purchase.credits_amount.toLocaleString('pt-BR')} créditos via Mercado Pago`,
      });

      if (creditError) {
        console.error('Erro ao adicionar créditos:', creditError);
        // Continuar mesmo com erro, para não perder o status
      } else {
        updateData.ledger_id = ledgerId;
        console.log('Créditos adicionados com sucesso, ledger_id:', ledgerId);
      }
    } else if (mpPayment.status === 'rejected' || mpPayment.status === 'cancelled') {
      updateData.status = mpPayment.status;
    }

    // Atualizar compra
    const { error: updateError } = await supabase
      .from('credit_purchases')
      .update(updateData)
      .eq('id', purchaseId);

    if (updateError) {
      console.error('Erro ao atualizar compra:', updateError);
    } else {
      console.log('Compra atualizada com sucesso');
    }

    return new Response('OK', { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    // Sempre retornar 200 para evitar retries infinitos
    return new Response('OK', { status: 200, headers: corsHeaders });
  }
});
