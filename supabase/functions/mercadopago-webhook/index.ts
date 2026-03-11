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
        await supabase.from('webhook_logs').insert({
          source: 'mercadopago',
          event_type: 'signature_invalid',
          payload: { raw: rawBody, reason: 'Missing signature headers' },
        });
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

      // Build manifest
      const dataId = payload.data?.id || '';
      const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

      // Compute HMAC-SHA256
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw', encoder.encode(mpWebhookSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(manifest));
      const computedHash = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0')).join('');

      if (computedHash !== v1) {
        console.error('❌ Assinatura HMAC inválida para Mercado Pago');
        await supabase.from('webhook_logs').insert({
          source: 'mercadopago',
          event_type: 'signature_invalid',
          payload: { raw: rawBody, manifest, computed: computedHash, received: v1 },
        });
        return new Response('Unauthorized', { status: 401, headers: corsHeaders });
      }
      console.log('✅ Assinatura Mercado Pago válida');
    }

    // Processar apenas eventos de pagamento
    if (payload.type !== 'payment') {
      console.log('Ignorando evento não-payment:', payload.type);
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    const paymentId = payload.data?.id;
    if (!paymentId) {
      console.log('Webhook sem payment ID');
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    // Try to get payment details - first check if it's from a connected account
    // by looking for the cobranca or credit_purchase with this payment ID
    let mpPayment: Record<string, unknown> | null = null;

    // First, try with global token (for credit purchases)
    if (mpAccessToken) {
      const globalResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${mpAccessToken}` },
      });
      
      if (globalResponse.ok) {
        mpPayment = await globalResponse.json();
        console.log('Pagamento encontrado com token global');
      }
    }

    // If not found with global token, try to find cobranca and use photographer's token
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
            console.log('Pagamento encontrado com token do fotógrafo');
          }
        }
      }
    }

    if (!mpPayment) {
      console.error('Não foi possível obter detalhes do pagamento');
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    console.log('Pagamento MP:', {
      id: mpPayment.id,
      status: mpPayment.status,
      external_reference: mpPayment.external_reference,
    });

    const externalReference = mpPayment.external_reference as string;
    if (!externalReference) {
      console.log('Pagamento sem external_reference');
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    // Determine if this is a credit purchase or gallery charge
    // Check credit_purchases first
    const { data: purchase } = await supabase
      .from('credit_purchases')
      .select('*')
      .eq('id', externalReference)
      .maybeSingle();

    if (purchase) {
      // This is a CREDIT PURCHASE (photographer buying credits from Lunari)
      console.log('Processando como compra de créditos:', externalReference);
      
      if (purchase.status === 'approved') {
        console.log('Compra já aprovada, ignorando webhook');
        return new Response('OK', { status: 200, headers: corsHeaders });
      }

      const updateData: Record<string, unknown> = {
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

        console.log('Pagamento aprovado, adicionando créditos:', {
          user_id: purchase.user_id,
          credits: purchase.credits_amount,
        });

        const { data: ledgerId, error: creditError } = await supabase.rpc('purchase_credits', {
          _user_id: purchase.user_id,
          _amount: purchase.credits_amount,
          _purchase_id: purchase.id,
          _description: `Compra de ${purchase.credits_amount.toLocaleString('pt-BR')} créditos via Mercado Pago`,
        });

        if (creditError) {
          console.error('Erro ao adicionar créditos:', creditError);
        } else {
          updateData.ledger_id = ledgerId;
          console.log('Créditos adicionados com sucesso, ledger_id:', ledgerId);
        }
      } else if (mpPayment.status === 'rejected' || mpPayment.status === 'cancelled') {
        updateData.status = mpPayment.status;
      }

      const { error: updateError } = await supabase
        .from('credit_purchases')
        .update(updateData)
        .eq('id', externalReference);

      if (updateError) {
        console.error('Erro ao atualizar compra:', updateError);
      } else {
        console.log('Compra de créditos atualizada com sucesso');
      }

    } else {
      // Check if it's a gallery charge (cobrancas)
      const { data: cobranca } = await supabase
        .from('cobrancas')
        .select('*, galerias(id, user_id, fotos_selecionadas, fotos_incluidas)')
        .eq('id', externalReference)
        .maybeSingle();

      if (cobranca) {
        // This is a GALLERY CHARGE (client paying photographer for extra photos)
        console.log('Processando como cobrança de galeria:', externalReference);

        if (cobranca.status === 'pago') {
          console.log('Cobrança já paga, ignorando webhook');
          return new Response('OK', { status: 200, headers: corsHeaders });
        }

        if (mpPayment.status === 'approved') {
          const now = new Date().toISOString();

          // Save MP-specific fields before RPC
          await supabase
            .from('cobrancas')
            .update({ mp_payment_id: String(mpPayment.id) })
            .eq('id', externalReference);

          // Call centralized RPC for atomic payment finalization
          const { data: rpcResult, error: rpcError } = await supabase.rpc('finalize_gallery_payment', {
            p_cobranca_id: externalReference,
            p_receipt_url: null,
            p_paid_at: now,
          });

          if (rpcError) {
            console.error('❌ RPC finalize_gallery_payment error:', rpcError);
          } else {
            console.log('✅ finalize_gallery_payment result:', JSON.stringify(rpcResult));
          }

          // Log action
          if (cobranca.galeria_id) {
            await supabase.from('galeria_acoes').insert({
              galeria_id: cobranca.galeria_id,
              tipo: 'pagamento_confirmado',
              descricao: `Pagamento de R$ ${cobranca.valor.toFixed(2)} confirmado via Mercado Pago`,
              user_id: cobranca.user_id,
            });
          }

          console.log('Cobrança de galeria processada com sucesso');

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

    return new Response('OK', { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    return new Response('OK', { status: 200, headers: corsHeaders });
  }
});
