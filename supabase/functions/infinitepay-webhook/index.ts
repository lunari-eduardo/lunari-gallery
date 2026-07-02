/**
 * v2.0.0 — Resposta rápida + processamento em background (2026-06-06)
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  CONTRATO COMPARTILHADO — NÃO MODIFICAR SEM COORDENAÇÃO    ║
 * ║                                                              ║
 * ║  REGRAS IMUTÁVEIS:                                           ║
 * ║  1. NÃO adicionar verificação de JWT                         ║
 * ║  2. verify_jwt DEVE ser false no config.toml                 ║
 * ║  3. Sempre chamar finalize_gallery_payment para sincronizar  ║
 * ║  4. Busca por ip_order_nsu PRIMEIRO, fallback por id (UUID)  ║
 * ║                                                              ║
 * ║  Projetos: Gallery (Select) + Gestão                         ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logWebhookEvent, getCorrelationId, acquireWebhookLock } from '../_shared/audit.ts';
import { fetchInfinitePayInvoice } from '../_shared/infinitepay-fetch-invoice.ts';
import { enrichClienteIfMissing } from '../_shared/enrich-cliente.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-correlation-id',
};

async function notifyPaymentConfirmed(supabaseUrl: string, serviceKey: string, paymentId: string) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: 'payment_confirmed', paymentId }),
    });
    if (!response.ok) console.warn('⚠️ payment email notification failed:', response.status, await response.text());
  } catch (error) {
    console.warn('⚠️ payment email notification exception:', error);
  }
}

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

/**
 * Após confirmar o pagamento, tenta buscar customer.email/phone no invoice
 * da InfinitePay para enriquecer o cadastro do cliente e/ou visitante.
 * Silencioso em erro. Nunca sobrescreve dado existente (respeita enrichClienteIfMissing).
 */
async function enrichFromInfinitePayInvoice(
  supabase: any,
  cobranca: { id: string; cliente_id: string | null; visitor_id: string | null; galeria_id: string | null; ip_invoice_slug?: string | null },
  slugFromPayload: string | null,
) {
  try {
    const slug = slugFromPayload || cobranca.ip_invoice_slug || null;
    if (!slug) {
      console.log('[IP_ENRICH] sem invoice_slug — pulando');
      return;
    }
    // Persiste slug (se veio apenas do payload) para retentativas futuras
    if (slugFromPayload && !cobranca.ip_invoice_slug) {
      await supabase.from('cobrancas').update({ ip_invoice_slug: slugFromPayload }).eq('id', cobranca.id);
    }
    const inv = await fetchInfinitePayInvoice(slug);
    const c = inv?.customer;
    if (!c) {
      console.log('[IP_ENRICH] invoice não retornou customer');
      return;
    }
    console.log(`[IP_ENRICH] customer recebido: email=${c.email ? 'Y' : 'N'} phone=${c.phone_number ? 'Y' : 'N'}`);

    // Enriquecer cliente vinculado (só grava colunas vazias)
    if (cobranca.cliente_id) {
      await enrichClienteIfMissing(supabase, cobranca.cliente_id, {
        email: c.email,
        telefone: c.phone_number,
      });
    }

    // Enriquecer visitante da galeria (contato vazio)
    if (cobranca.visitor_id) {
      if (contato && contato_tipo) {
        await supabase
          .from('galeria_visitantes')
          .update({ contato, contato_tipo, updated_at: new Date().toISOString() })
          .eq('id', cobranca.visitor_id)
          .or('contato.is.null,contato.eq.');
      }
        await supabase
          .from('galeria_visitantes')
          .update({ contato, contato_tipo, updated_at: new Date().toISOString() })
          .eq('id', cobranca.visitor_id)
          .or('contato.is.null,contato.eq.');
      }
      if (c.name) {
        await supabase
          .from('galeria_visitantes')
          .update({ nome: c.name, updated_at: new Date().toISOString() })
          .eq('id', cobranca.visitor_id)
          .or('nome.is.null,nome.eq.');
      }
    }
  } catch (e) {
    console.warn('[IP_ENRICH] exceção:', e instanceof Error ? e.message : String(e));
  }
}

// Handler principal de processamento em background
async function processWebhookInBackground(
  supabase: any,
  payload: InfinitePayWebhookPayload,
  initialLogId: string,
  supabaseUrl: string,
  supabaseServiceKey: string
) {
  const orderNsu = payload.order_nsu!;
  try {
    console.log(`⚙️ [Background] Processing order_nsu: ${orderNsu}`);

    // PASSO 1: Buscar cobrança (ip_order_nsu -> id)
    let cobranca = null;
    let foundBy: string | null = null;

    const { data: nsuData } = await supabase.from('cobrancas').select('*').eq('ip_order_nsu', orderNsu).maybeSingle();
    if (nsuData) {
      cobranca = nsuData;
      foundBy = 'ip_order_nsu';
    } else {
      const { data: idData } = await supabase.from('cobrancas').select('*').eq('id', orderNsu).maybeSingle();
      if (idData) {
        cobranca = idData;
        foundBy = 'id';
      }
    }

    if (!cobranca) {
      console.warn(`⚠️ [Background] Cobranca not found for: ${orderNsu}`);
      await supabase.from('webhook_logs').update({ 
        status: 'ignored', 
        error_message: 'Cobranca not found (searched by ip_order_nsu and id)',
        processed_at: new Date().toISOString()
      }).eq('id', initialLogId);
      return;
    }

    // PASSO 2: Check idempotência
    if (cobranca.status === 'pago') {
      console.log(`ℹ️ [Background] Already paid: ${orderNsu}`);
      await supabase.rpc('finalize_gallery_payment', {
        p_cobranca_id: cobranca.id,
        p_receipt_url: cobranca.ip_receipt_url || payload.receipt_url || null,
        p_paid_at: cobranca.data_pagamento || new Date().toISOString(),
      });
      await enrichFromInfinitePayInvoice(supabase, cobranca, payload.invoice_slug || null);
      await supabase.from('webhook_logs').update({ 
        status: 'already_processed', 
        processed_at: new Date().toISOString()
      }).eq('id', initialLogId);
      return;
    }

    // PASSO 3: Update e Finalize
    if (payload.transaction_nsu) {
      await supabase.from('cobrancas').update({ ip_transaction_nsu: payload.transaction_nsu }).eq('id', cobranca.id);
    }

    const { data: rpcResult, error: rpcError } = await supabase.rpc('finalize_gallery_payment', {
      p_cobranca_id: cobranca.id,
      p_receipt_url: payload.receipt_url || null,
      p_paid_at: new Date().toISOString(),
    });

    if (rpcError) throw rpcError;

    console.log(`✅ [Background] Success for ${orderNsu}`);
    await notifyPaymentConfirmed(supabaseUrl, supabaseServiceKey, cobranca.id);
    await enrichFromInfinitePayInvoice(supabase, cobranca, payload.invoice_slug || null);

    await logWebhookEvent({
      provider: 'infinitepay',
      externalId: orderNsu,
      eventName: payload.status || 'payment_done',
      payload: payload,
      status: 'success'
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ [Background] Error: ${msg}`);
    await supabase.from('webhook_logs').update({
      status: 'exception',
      error_message: msg,
      processed_at: new Date().toISOString()
    }).eq('id', initialLogId);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  console.log('[INFINITEPAY_WEBHOOK_VERSION] v2.0 (Fast-ACK)');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let initialLogId: string | null = null;
  let payload: InfinitePayWebhookPayload | null = null;
  const rawBody = await req.text();

  try {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

    // 1. Validação HMAC
    const webhookSecret = Deno.env.get('INFINITEPAY_WEBHOOK_SECRET');
    if (webhookSecret) {
      const receivedSignature = req.headers.get('x-infinia-signature') || req.headers.get('X-Infinia-Signature');
      if (!receivedSignature) return new Response('Missing signature', { status: 401, headers: corsHeaders });

      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', encoder.encode(webhookSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
      const computedSignature = Array.from(new Uint8Array(signatureBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      
      if (computedSignature !== receivedSignature.toLowerCase()) {
        console.error('❌ HMAC mismatch');
        return new Response('Invalid signature', { status: 401, headers: corsHeaders });
      }
    }

    // 2. Audit Log and Idempotency Check
    payload = JSON.parse(rawBody);
    const orderNsu = payload?.order_nsu;
    const provider = 'infinitepay';
    const externalId = orderNsu || 'unknown';
    const eventName = payload?.status || 'payment_done'; // InfinitePay simplified events
    const correlationId = getCorrelationId(req);

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
      return new Response(JSON.stringify({ success: true, message: 'Already processed' }), { status: 200, headers: corsHeaders });
    }

    if (!lockAcquired) {
      console.warn(`🔒 Could not acquire lock for webhook ${provider}:${externalId}:${eventName}.`);
      return new Response(JSON.stringify({ error: 'Processing' }), { status: 409, headers: corsHeaders });
    }

    if (!orderNsu) return new Response('Missing order_nsu', { status: 400, headers: corsHeaders });

    // 3. Resposta Rápida (libera a InfinitePay)
    // Usamos waitUntil para manter a função viva processando em background no Deno Deploy / Supabase
    // @ts-ignore: EdgeRuntime is available in some environments, but we check availability
    if (typeof (globalThis as any).EdgeRuntime !== 'undefined' || (req as any).waitUntil) {
       const wait = (req as any).waitUntil ? (p: Promise<any>) => (req as any).waitUntil(p) : (p: Promise<any>) => p;
       wait(processWebhookInBackground(supabase, payload, initialLogId!, supabaseUrl, supabaseServiceKey));
    } else {
       // Fallback síncrono para garantir entrega em runtimes limitados
       await processWebhookInBackground(supabase, payload, initialLogId!, supabaseUrl, supabaseServiceKey);
    }

    return new Response(JSON.stringify({ success: true, message: 'Received' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Webhook error:', msg);
    return new Response(JSON.stringify({ error: 'Internal error', details: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
