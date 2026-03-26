import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  cobrancaId?: string;
  orderNsu?: string;
  sessionId?: string;
  forceUpdate?: boolean;
  transactionNsu?: string;
  slug?: string;
  receiptUrl?: string;
}

// ============================================================
// VERIFICAÇÃO VIA API ASAAS — pagamento individual
// ============================================================
async function checkAsaasPaymentStatus(
  supabase: any,
  cobranca: any,
): Promise<{ status: 'paid' | 'pending' | 'error'; netValue?: number; paymentId?: string }> {
  try {
    const userId = cobranca.user_id;
    console.log('🔍 Buscando integração Asaas para user_id:', userId);

    const { data: integracao, error: integError } = await supabase
      .from('usuarios_integracoes')
      .select('access_token, dados_extras')
      .eq('user_id', userId)
      .eq('provedor', 'asaas')
      .eq('status', 'ativo')
      .maybeSingle();

    if (integError || !integracao?.access_token) {
      console.error('❌ Integração Asaas não encontrada:', integError);
      return { status: 'error' };
    }

    const asaasApiKey = integracao.access_token;
    const settings = (integracao.dados_extras || {}) as { environment?: string };
    const asaasBaseUrl = settings.environment === 'production'
      ? 'https://api.asaas.com'
      : 'https://api-sandbox.asaas.com';

    const paymentId = cobranca.mp_payment_id;
    if (!paymentId) {
      console.log('⚠️ Cobrança sem mp_payment_id');
      return { status: 'error' };
    }

    console.log('🔍 Consultando status Asaas para payment:', paymentId);

    const response = await fetch(`${asaasBaseUrl}/v3/payments/${paymentId}`, {
      headers: { access_token: asaasApiKey },
    });

    if (!response.ok) {
      console.log('⚠️ Asaas API retornou erro:', response.status);
      return { status: 'error' };
    }

    const data = await response.json();
    console.log('📊 Resposta Asaas:', JSON.stringify({ id: data.id, status: data.status, netValue: data.netValue }));

    const confirmedStatuses = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH', 'PAYMENT_ANTICIPATED'];
    if (confirmedStatuses.includes(data.status)) {
      return { status: 'paid', netValue: data.netValue, paymentId: data.id };
    }

    return { status: 'pending' };
  } catch (error) {
    console.error('❌ Erro ao consultar Asaas API:', error);
    return { status: 'error' };
  }
}

// ============================================================
// VERIFICAÇÃO VIA API ASAAS — INSTALLMENT (todas as parcelas)
// GET /v3/installments/{id}/payments
// ============================================================
async function checkAsaasInstallmentPayments(
  supabase: any,
  cobranca: any,
): Promise<{ allConfirmed: boolean; confirmedCount: number; totalCount: number }> {
  try {
    const userId = cobranca.user_id;
    const installmentId = cobranca.asaas_installment_id;

    if (!installmentId) {
      console.log('⚠️ Cobrança sem asaas_installment_id');
      return { allConfirmed: false, confirmedCount: 0, totalCount: cobranca.total_parcelas || 1 };
    }

    const { data: integracao } = await supabase
      .from('usuarios_integracoes')
      .select('access_token, dados_extras')
      .eq('user_id', userId)
      .eq('provedor', 'asaas')
      .eq('status', 'ativo')
      .maybeSingle();

    if (!integracao?.access_token) {
      return { allConfirmed: false, confirmedCount: 0, totalCount: cobranca.total_parcelas || 1 };
    }

    const asaasApiKey = integracao.access_token;
    const settings = (integracao.dados_extras || {}) as { environment?: string };
    const asaasBaseUrl = settings.environment === 'production'
      ? 'https://api.asaas.com'
      : 'https://api-sandbox.asaas.com';

    console.log(`🔍 Consultando installment ${installmentId} no Asaas...`);

    const response = await fetch(`${asaasBaseUrl}/v3/installments/${installmentId}`, {
      headers: { access_token: asaasApiKey },
    });

    if (!response.ok) {
      console.log('⚠️ Falha ao consultar installment:', response.status);
      return { allConfirmed: false, confirmedCount: 0, totalCount: cobranca.total_parcelas || 1 };
    }

    const installmentData = await response.json();
    console.log(`📊 Installment: totalValue=${installmentData.totalValue}, installmentCount=${installmentData.installmentCount}`);

    // Now fetch all payments for this installment
    const paymentsResp = await fetch(`${asaasBaseUrl}/v3/payments?installment=${installmentId}&limit=50`, {
      headers: { access_token: asaasApiKey },
    });

    if (!paymentsResp.ok) {
      console.log('⚠️ Falha ao buscar payments do installment');
      return { allConfirmed: false, confirmedCount: 0, totalCount: cobranca.total_parcelas || 1 };
    }

    const paymentsData = await paymentsResp.json();
    const payments = paymentsData.data || [];
    const confirmedStatuses = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'];
    let confirmedCount = 0;

    console.log(`📊 Encontradas ${payments.length} parcelas no Asaas`);

    for (const payment of payments) {
      if (!confirmedStatuses.includes(payment.status)) {
        console.log(`⏳ Parcela ${payment.installmentNumber}: status=${payment.status} (pendente)`);
        continue;
      }

      confirmedCount++;
      const valorBruto = payment.value;
      const netValue = payment.netValue ?? valorBruto;
      const taxaGateway = Math.round((valorBruto - netValue) * 100) / 100;
      const numeroParcela = payment.installmentNumber || confirmedCount;

      console.log(`✅ Parcela ${numeroParcela}: bruto=${valorBruto}, líquido=${netValue}, taxa=${taxaGateway}`);

      // Upsert parcela using asaas_payment_id as conflict key
      const { error: parcelaError } = await supabase
        .from('cobranca_parcelas')
        .upsert({
          cobranca_id: cobranca.id,
          numero_parcela: numeroParcela,
          asaas_payment_id: payment.id,
          valor_bruto: valorBruto,
          valor_liquido: netValue,
          taxa_gateway: taxaGateway >= 0 ? taxaGateway : 0,
          status: 'confirmado',
          billing_type: payment.billingType?.toLowerCase() || 'card',
          data_pagamento: payment.paymentDate || new Date().toISOString().split('T')[0],
          data_vencimento: payment.dueDate || null,
        }, { onConflict: 'asaas_payment_id' });

      if (parcelaError) {
        console.error(`❌ Erro ao upsert parcela ${numeroParcela}:`, parcelaError);
      }
    }

    const totalCount = installmentData.installmentCount || cobranca.total_parcelas || payments.length;
    const allConfirmed = confirmedCount >= totalCount;

    console.log(`📊 Resultado installment: ${confirmedCount}/${totalCount} confirmadas, allConfirmed=${allConfirmed}`);

    // Update cobrancas.valor_liquido with sum from parcelas
    if (confirmedCount > 0) {
      const { data: parcelasSum } = await supabase
        .from('cobranca_parcelas')
        .select('valor_liquido')
        .eq('cobranca_id', cobranca.id)
        .eq('status', 'confirmado');

      if (parcelasSum && parcelasSum.length > 0) {
        const totalLiquido = parcelasSum.reduce((sum: number, p: any) => sum + (Number(p.valor_liquido) || 0), 0);
        const roundedLiquido = Math.round(totalLiquido * 100) / 100;
        await supabase
          .from('cobrancas')
          .update({ valor_liquido: roundedLiquido })
          .eq('id', cobranca.id);
        console.log(`📊 Atualizado cobrancas.valor_liquido = ${roundedLiquido}`);
      }
    }

    return { allConfirmed, confirmedCount, totalCount };
  } catch (error) {
    console.error('❌ Erro ao consultar installment Asaas:', error);
    return { allConfirmed: false, confirmedCount: 0, totalCount: cobranca.total_parcelas || 1 };
  }
}

// Helper: upsert parcela for single Asaas payment
async function upsertAsaasParcela(
  supabase: any,
  cobrancaId: string,
  paymentId: string,
  valorBruto: number,
  netValue: number,
  numeroParcela: number,
) {
  const taxaGateway = Math.round((valorBruto - netValue) * 100) / 100;
  console.log(`📝 Upsert parcela: cobranca=${cobrancaId}, parcela=${numeroParcela}, bruto=${valorBruto}, liquido=${netValue}, taxa=${taxaGateway}`);

  const { error: parcelaError } = await supabase
    .from('cobranca_parcelas')
    .upsert({
      cobranca_id: cobrancaId,
      numero_parcela: numeroParcela,
      asaas_payment_id: paymentId,
      valor_bruto: valorBruto,
      valor_liquido: netValue,
      taxa_gateway: taxaGateway,
      status: 'confirmado',
      billing_type: 'card',
      data_pagamento: new Date().toISOString().split('T')[0],
    }, { onConflict: 'asaas_payment_id' });

  if (parcelaError) {
    console.error('❌ Erro ao upsert parcela:', parcelaError);
    return false;
  }

  // Update cobrancas.valor_liquido
  await supabase
    .from('cobrancas')
    .update({ valor_liquido: netValue })
    .eq('id', cobrancaId);

  return true;
}

// ============================================================
// VERIFICAÇÃO VIA ENDPOINT PÚBLICO INFINITEPAY
// ============================================================
async function checkInfinitePayStatusPublic(
  supabase: any,
  userId: string,
  orderNsu: string,
  transactionNsu?: string,
  slug?: string
): Promise<{ status: 'paid' | 'pending' | 'error'; receiptUrl?: string; paidAmount?: number }> {
  try {
    console.log('🔍 Buscando handle InfinitePay para user_id:', userId);
    
    const { data: integracao, error: integracaoError } = await supabase
      .from('usuarios_integracoes')
      .select('dados_extras')
      .eq('user_id', userId)
      .eq('provedor', 'infinitepay')
      .eq('status', 'ativo')
      .maybeSingle();
    
    if (integracaoError) {
      console.error('❌ Erro ao buscar integração:', integracaoError);
      return { status: 'error' };
    }
    
    const handle = integracao?.dados_extras?.handle;
    if (!handle) {
      console.log('⚠️ Handle InfinitePay não encontrado');
      return { status: 'error' };
    }
    
    const response = await fetch('https://api.infinitepay.io/invoices/public/checkout/payment_check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle,
        order_nsu: orderNsu,
        transaction_nsu: transactionNsu,
        slug,
      }),
    });
    
    if (!response.ok) {
      console.log('⚠️ InfinitePay API retornou erro:', response.status);
      return { status: 'error' };
    }
    
    const data = await response.json();
    console.log('📊 Resposta InfinitePay:', JSON.stringify(data));
    
    if (data.success && data.paid) {
      return { status: 'paid', receiptUrl: data.receipt_url, paidAmount: data.paid_amount };
    }
    
    return { status: 'pending' };
  } catch (error) {
    console.error('❌ Erro ao consultar InfinitePay API:', error);
    return { status: 'error' };
  }
}

// ============================================================
// ORDEM DE BUSCA FIXA
// ============================================================
async function findCobrancaByOrderNsu(supabase: any, orderNsu: string) {
  let cobranca = null;
  let error = null;
  let foundBy: 'ip_order_nsu' | 'id' | null = null;

  const { data: cobrancaByNsu, error: nsuError } = await supabase
    .from('cobrancas')
    .select('*')
    .eq('ip_order_nsu', orderNsu)
    .maybeSingle();

  if (nsuError) {
    error = nsuError;
  } else if (cobrancaByNsu) {
    cobranca = cobrancaByNsu;
    foundBy = 'ip_order_nsu';
  }

  if (!cobranca && !error) {
    const { data: cobrancaById, error: idError } = await supabase
      .from('cobrancas')
      .select('*')
      .eq('id', orderNsu)
      .maybeSingle();

    if (idError) {
      error = idError;
    } else if (cobrancaById) {
      cobranca = cobrancaById;
      foundBy = 'id';
    }
  }

  return { cobranca, error, foundBy };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();
    const { cobrancaId, orderNsu, sessionId, forceUpdate, transactionNsu, slug, receiptUrl } = body;

    console.log('🔍 Verificando status de pagamento:', { cobrancaId, orderNsu, sessionId, forceUpdate });

    let cobranca = null;
    let cobrancaError = null;
    let foundBy: string | null = null;

    if (cobrancaId) {
      const { data, error } = await supabase
        .from('cobrancas')
        .select('*')
        .eq('id', cobrancaId)
        .maybeSingle();
      cobranca = data;
      cobrancaError = error;
      if (cobranca) foundBy = 'cobrancaId';
    } else if (orderNsu) {
      const result = await findCobrancaByOrderNsu(supabase, orderNsu);
      cobranca = result.cobranca;
      cobrancaError = result.error;
      foundBy = result.foundBy;
    } else if (sessionId) {
      const { data, error } = await supabase
        .from('cobrancas')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      cobranca = data;
      cobrancaError = error;
      if (cobranca) foundBy = 'sessionId';
    } else {
      return new Response(
        JSON.stringify({ error: 'Informe cobrancaId, orderNsu ou sessionId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (cobrancaError) {
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar cobrança', details: cobrancaError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!cobranca) {
      return new Response(
        JSON.stringify({ found: false, message: 'Cobrança não encontrada' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📋 Cobrança encontrada:', { id: cobranca.id, status: cobranca.status, provedor: cobranca.provedor, foundBy });

    // Helper: finalize via RPC
    const finalize = async (receiptUrlParam?: string) => {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('finalize_gallery_payment', {
        p_cobranca_id: cobranca.id,
        p_receipt_url: receiptUrlParam || null,
        p_paid_at: new Date().toISOString(),
      });
      if (rpcError) {
        console.error('❌ RPC finalize_gallery_payment error:', rpcError);
        return { success: false, error: rpcError.message };
      }
      console.log('✅ finalize_gallery_payment result:', JSON.stringify(rpcResult));
      return { success: true, result: rpcResult };
    };

    const buildResponse = (status: string, extra: Record<string, unknown> = {}) => {
      return new Response(
        JSON.stringify({
          found: true,
          status,
          foundBy,
          cobranca: {
            id: cobranca.id,
            status,
            valor: cobranca.valor,
            provedor: cobranca.provedor,
            dataPagamento: cobranca.data_pagamento,
            receiptUrl: cobranca.ip_receipt_url,
          },
          ...extra,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    };

    // === ALREADY PAID: auto-heal ===
    if (cobranca.status === 'pago') {
      console.log('💳 Cobrança já paga — auto-heal');
      await finalize(cobranca.ip_receipt_url);
      return buildResponse('pago', { gallerySynced: true });
    }

    // === ASAAS: pending OR parcialmente_pago ===
    if ((cobranca.status === 'pendente' || cobranca.status === 'parcialmente_pago') && cobranca.provedor === 'asaas') {
      console.log(`🔄 Asaas cobrança ${cobranca.status} — verificando...`);

      const isInstallment = (cobranca.total_parcelas || 1) > 1 && cobranca.asaas_installment_id;

      if (isInstallment) {
        // INSTALLMENT: query all parcelas from Asaas
        const installResult = await checkAsaasInstallmentPayments(supabase, cobranca);

        if (installResult.allConfirmed) {
          console.log('✅ Todas as parcelas confirmadas — finalizando...');
          await finalize();
          return buildResponse('pago', { updated: true, source: 'asaas_installment_polling' });
        } else if (installResult.confirmedCount > 0) {
          // Some parcelas confirmed, but not all — trigger reconcile happened via upsert
          // Re-read cobranca to get updated status
          const { data: refreshed } = await supabase
            .from('cobrancas')
            .select('status, parcelas_pagas')
            .eq('id', cobranca.id)
            .single();

          const currentStatus = refreshed?.status || 'parcialmente_pago';
          console.log(`⏳ Parcelas: ${installResult.confirmedCount}/${installResult.totalCount}, status=${currentStatus}`);

          if (currentStatus === 'pago') {
            await finalize();
            return buildResponse('pago', { updated: true, source: 'asaas_installment_polling' });
          }

          return buildResponse(currentStatus, {
            parcelasPagas: installResult.confirmedCount,
            totalParcelas: installResult.totalCount,
          });
        }
      } else {
        // SINGLE payment: check individual payment
        if (cobranca.mp_payment_id) {
          const asaasResult = await checkAsaasPaymentStatus(supabase, cobranca);

          if (asaasResult.status === 'paid' && asaasResult.netValue != null) {
            console.log('💰 Asaas confirmou pagamento único — processando...');

            const totalParcelas = cobranca.total_parcelas || 1;
            const valorBrutoParcela = Math.round((cobranca.valor / totalParcelas) * 100) / 100;

            await upsertAsaasParcela(
              supabase,
              cobranca.id,
              asaasResult.paymentId || cobranca.mp_payment_id,
              valorBrutoParcela,
              asaasResult.netValue,
              1,
            );

            await finalize();
            return buildResponse('pago', { updated: true, source: 'asaas_api_polling' });
          }
        }
      }

      // Still pending
      return buildResponse(cobranca.status);
    }

    // === INFINITEPAY: pending ===
    if (cobranca.status === 'pendente' && cobranca.provedor === 'infinitepay' && cobranca.ip_order_nsu) {
      console.log('🔄 Status pendente — verificando InfinitePay...');
      
      const ipResult = await checkInfinitePayStatusPublic(
        supabase,
        cobranca.user_id,
        cobranca.ip_order_nsu,
        transactionNsu,
        slug
      );
      
      if (ipResult.status === 'paid') {
        console.log('💰 InfinitePay confirmou pagamento');
        
        if (transactionNsu || receiptUrl || ipResult.receiptUrl) {
          const metaData: Record<string, unknown> = {};
          if (transactionNsu) metaData.ip_transaction_nsu = transactionNsu;
          if (receiptUrl || ipResult.receiptUrl) metaData.ip_receipt_url = receiptUrl || ipResult.receiptUrl;
          await supabase.from('cobrancas').update(metaData).eq('id', cobranca.id);
        }
        
        const finalizeResult = await finalize(receiptUrl || ipResult.receiptUrl);
        if (finalizeResult.success) {
          return buildResponse('pago', { updated: true, source: 'infinitepay_public_api' });
        }
      }
    }

    // === FORCE UPDATE (redirect detection) ===
    if (forceUpdate && cobranca.status === 'pendente') {
      console.log('⚡ Forçando atualização para pago (forceUpdate=true)');

      if (transactionNsu || receiptUrl) {
        const updateData: Record<string, unknown> = {};
        if (transactionNsu) updateData.ip_transaction_nsu = transactionNsu;
        if (receiptUrl) updateData.ip_receipt_url = receiptUrl;
        await supabase.from('cobrancas').update(updateData).eq('id', cobranca.id);
      }

      const finalizeResult = await finalize(receiptUrl);
      if (finalizeResult.success) {
        return buildResponse('pago', { updated: true, source: 'force_update' });
      }

      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar cobrança', details: finalizeResult.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return current status
    return buildResponse(cobranca.status, {
      cobranca: {
        id: cobranca.id,
        status: cobranca.status,
        valor: cobranca.valor,
        provedor: cobranca.provedor,
        checkoutUrl: cobranca.ip_checkout_url,
        orderNsu: cobranca.ip_order_nsu,
        createdAt: cobranca.created_at,
      },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Erro interno:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
