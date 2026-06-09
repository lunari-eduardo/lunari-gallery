import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { logWebhookEvent, getCorrelationId, acquireWebhookLock } from '../_shared/audit.ts';
import { processGalleryPayment, processCreditPurchase } from '../_shared/payment-processor.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-correlation-id',
};

// E-mail notification now handled by shared processor

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

  const correlationId = getCorrelationId(req);
  let rawBody = '';
  try {
    rawBody = await req.text();
    const payload: WebhookPayload = JSON.parse(rawBody);
    
    // 1. Audit Log and Idempotency Check
    const provider = 'mercadopago';
    const externalId = payload.data?.id || 'unknown';
    const eventName = payload.type || 'unknown';

    await logWebhookEvent({
      correlationId,
      provider,
      externalId,
      eventName,
      payload: payload,
      status: 'received'
    });

    const { isAlreadyProcessed, lockAcquired } = await acquireWebhookLock(provider, externalId, eventName);

    if (isAlreadyProcessed) {
      console.log(`ℹ️ Webhook ${provider}:${externalId}:${eventName} already processed successfully.`);
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    if (!lockAcquired) {
      console.warn(`🔒 Could not acquire lock for webhook ${provider}:${externalId}:${eventName}.`);
      return new Response('Locked', { status: 409, headers: corsHeaders });
    }

    console.log('Webhook Mercado Pago recebido:', {
      type: payload.type,
      action: payload.action,
      data_id: payload.data?.id,
    });

    // ============================================================
    // VALIDAÇÃO DE ASSINATURA MERCADO PAGO - HMAC-SHA256
    // ============================================================
    const mpWebhookSecret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET');
    if (!mpWebhookSecret) {
      console.warn('⚠️ MERCADOPAGO_WEBHOOK_SECRET não configurado — validação de assinatura desabilitada');
    } else {
      const xSignature = req.headers.get('x-signature');
      const xRequestId = req.headers.get('x-request-id');
      
      if (!xSignature || !xRequestId) {
        console.error('❌ Headers x-signature ou x-request-id ausentes');
        return new Response('Unauthorized', { status: 401, headers: corsHeaders });
      }

      // Parse x-signature: "ts=...,v1=..."
      const parts: Record<string, string> = {};
      for (const part of xSignature.split(',')) {
        const [key, ...vals] = part.split('=');
        if (key && vals.length) parts[key.trim()] = vals.join('=').trim();
      }
      const ts = parts['ts'];
      const v1 = parts['v1'];

      if (!ts || !v1) {
        console.error('❌ x-signature mal formatado:', xSignature);
        return new Response('Unauthorized', { status: 401, headers: corsHeaders });
      }

      const dataId = payload.data?.id || '';
      const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw', encoder.encode(mpWebhookSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(manifest));
      const computedHash = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0')).join('');

      if (computedHash !== v1) {
        console.error('❌ Assinatura HMAC inválida para Mercado Pago');
        return new Response('Unauthorized', { status: 401, headers: corsHeaders });
      }
      console.log('✅ Assinatura Mercado Pago válida');
    }

    if (payload.type !== 'payment') {
      console.log('Ignorando evento não-payment:', payload.type);
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    const paymentId = payload.data?.id;
    if (!paymentId) {
      console.log('Webhook sem payment ID');
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    let mpPayment: Record<string, any> | null = null;

    if (mpAccessToken) {
      const globalResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${mpAccessToken}` },
      });
      
      if (globalResponse.ok) {
        mpPayment = await globalResponse.json();
      }
    }

    if (!mpPayment) {
      const { data: cobranca } = await supabase
        .from('cobrancas')
        .select('user_id')
        .eq('mp_payment_id', paymentId)
        .maybeSingle();

      if (cobranca) {
        const { data: integracao } = await supabase
          .from('usuarios_integracoes')
          .select('access_token')
          .eq('user_id', cobranca.user_id)
          .eq('provedor', 'mercadopago')
          .eq('status', 'ativo')
          .maybeSingle();

        if (integracao?.access_token) {
          const photographerResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { 'Authorization': `Bearer ${integracao.access_token}` },
          });

          if (photographerResponse.ok) {
            mpPayment = await photographerResponse.json();
          }
        }
      }
    }

    if (!mpPayment) {
      console.error('Não foi possível obter detalhes do pagamento');
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    const externalReference = mpPayment.external_reference as string;
    if (!externalReference) {
      console.log('Pagamento sem external_reference');
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    const { data: purchase } = await supabase
      .from('credit_purchases')
      .select('*')
      .eq('id', externalReference)
      .maybeSingle();

    if (purchase) {
      const result = await processCreditPurchase(supabase, purchase, mpPayment);
      if (!result.success) {
        console.error('Erro ao processar compra de créditos:', result.error);
      } else {
        console.log('Compra de créditos processada com sucesso');
      }
    } else {
      const { data: cobranca } = await supabase
        .from('cobrancas')
        .select('*')
        .eq('id', externalReference)
        .maybeSingle();

      if (cobranca) {
        console.log('Processando como cobrança de galeria:', externalReference);

        if (cobranca.status === 'pago') {
          console.log('Cobrança já paga, ignorando webhook');
          return new Response('OK', { status: 200, headers: corsHeaders });
        }

        if (mpPayment.status === 'approved') {
          const result = await processGalleryPayment(supabase, {
            provider: 'mercadopago',
            externalId: String(mpPayment.id),
            installmentNumber: 1,
            totalInstallments: 1,
            value: Number(mpPayment.transaction_amount),
            netValue: Number(mpPayment.transaction_details?.net_received_amount ?? mpPayment.transaction_amount),
            billingType: mpPayment.payment_method_id || 'credit_card',
            paymentDate: mpPayment.date_approved || new Date().toISOString(),
          });

          if (!result.success) {
            console.error('Erro ao processar pagamento de galeria:', result.error);
          } else {
            console.log('Pagamento de galeria processado com sucesso');
          }
        } else if (mpPayment.status === 'rejected' || mpPayment.status === 'cancelled') {
          await supabase
            .from('cobrancas')
            .update({ status: mpPayment.status as string })
            .eq('id', externalReference);
        }
      } else {
        console.log('external_reference não encontrado em nenhuma tabela:', externalReference);
      }
    }

    await logWebhookEvent({
      correlationId,
      provider: 'mercadopago',
      externalId: payload.data?.id || 'unknown',
      eventName: payload.type || 'unknown',
      payload: payload,
      status: 'success'
    });

    return new Response('OK', { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    return new Response('OK', { status: 200, headers: corsHeaders });
  }
});
