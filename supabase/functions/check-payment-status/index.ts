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
  // InfinitePay redirect parameters for public API verification
  transactionNsu?: string;
  slug?: string;
  receiptUrl?: string;
}

// ============================================================
// VERIFICAÇÃO VIA ENDPOINT PÚBLICO INFINITEPAY
// Não requer OAuth - usa apenas o handle do fotógrafo
// POST https://api.infinitepay.io/invoices/public/checkout/payment_check
// ============================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkInfinitePayStatusPublic(
  supabase: any,
  userId: string,
  orderNsu: string,
  transactionNsu?: string,
  slug?: string
): Promise<{ status: 'paid' | 'pending' | 'error'; receiptUrl?: string; paidAmount?: number }> {
  
  try {
    // Buscar handle do fotógrafo na tabela usuarios_integracoes
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
      console.log('⚠️ Handle InfinitePay não encontrado para o fotógrafo');
      return { status: 'error' };
    }
    
    console.log('🔍 Consultando status via endpoint PÚBLICO InfinitePay');
    console.log('📋 Parâmetros:', { handle, orderNsu, transactionNsu, slug });
    
    // ENDPOINT CORRETO: Público, não requer OAuth
    const response = await fetch('https://api.infinitepay.io/invoices/public/checkout/payment_check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle: handle,
        order_nsu: orderNsu,
        transaction_nsu: transactionNsu,
        slug: slug,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('⚠️ InfinitePay API retornou erro:', response.status, errorText);
      return { status: 'error' };
    }
    
    const data = await response.json();
    console.log('📊 Resposta InfinitePay:', JSON.stringify(data));
    
    // Verificar se pagamento foi confirmado
    if (data.success && data.paid) {
      console.log('✅ Pagamento CONFIRMADO via endpoint público');
      return { 
        status: 'paid', 
        receiptUrl: data.receipt_url,
        paidAmount: data.paid_amount,
      };
    }
    
    console.log('⏳ Pagamento ainda PENDENTE na InfinitePay');
    return { status: 'pending' };
    
  } catch (error) {
    console.error('❌ Erro ao consultar InfinitePay API:', error);
    return { status: 'error' };
  }
}

// ============================================================
// REGRA 3.1.4: ORDEM DE BUSCA FIXA
// 1º: Buscar por ip_order_nsu = order_nsu
// 2º: Fallback por id = order_nsu (UUID)
// ============================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findCobrancaByOrderNsu(supabase: any, orderNsu: string) {
  let cobranca = null;
  let error = null;
  let foundBy: 'ip_order_nsu' | 'id' | null = null;

  // PASSO 1: Buscar por ip_order_nsu
  console.log('🔍 PASSO 1: Buscando cobrança por ip_order_nsu:', orderNsu);
  const { data: cobrancaByNsu, error: nsuError } = await supabase
    .from('cobrancas')
    .select('*')
    .eq('ip_order_nsu', orderNsu)
    .maybeSingle();

  if (nsuError) {
    console.error('❌ Erro ao buscar por ip_order_nsu:', nsuError);
    error = nsuError;
  } else if (cobrancaByNsu) {
    cobranca = cobrancaByNsu;
    foundBy = 'ip_order_nsu';
    console.log('✅ Cobrança encontrada por ip_order_nsu');
  }

  // PASSO 2: Fallback - Buscar por id (UUID)
  if (!cobranca && !error) {
    console.log('🔄 PASSO 2: Cobrança não encontrada por ip_order_nsu, tentando por id (UUID)...');
    const { data: cobrancaById, error: idError } = await supabase
      .from('cobrancas')
      .select('*')
      .eq('id', orderNsu)
      .maybeSingle();

    if (idError) {
      console.error('❌ Erro ao buscar por id:', idError);
      error = idError;
    } else if (cobrancaById) {
      cobranca = cobrancaById;
      foundBy = 'id';
      console.log('✅ Cobrança encontrada por id (UUID)');
    }
  }

  return { cobranca, error, foundBy };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only accept POST requests
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

    console.log('🔍 Verificando status de pagamento:', { 
      cobrancaId, orderNsu, sessionId, forceUpdate,
      hasTransactionNsu: !!transactionNsu,
      hasSlug: !!slug,
      hasReceiptUrl: !!receiptUrl,
    });

    let cobranca = null;
    let cobrancaError = null;
    let foundBy: 'ip_order_nsu' | 'id' | 'cobrancaId' | 'sessionId' | null = null;

    // Find the charge based on provided parameters
    if (cobrancaId) {
      // Direct lookup by internal UUID
      const { data, error } = await supabase
        .from('cobrancas')
        .select('*')
        .eq('id', cobrancaId)
        .maybeSingle();
      cobranca = data;
      cobrancaError = error;
      if (cobranca) foundBy = 'cobrancaId';
    } else if (orderNsu) {
      // Use the contract-compliant dual search
      const result = await findCobrancaByOrderNsu(supabase, orderNsu);
      cobranca = result.cobranca;
      cobrancaError = result.error;
      foundBy = result.foundBy;
    } else if (sessionId) {
      // Select most recent cobrança for this session
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
      console.error('❌ Erro ao buscar cobrança:', cobrancaError);
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

    console.log('📋 Cobrança encontrada:', { 
      id: cobranca.id, 
      status: cobranca.status, 
      provedor: cobranca.provedor,
      valor: cobranca.valor,
      ip_order_nsu: cobranca.ip_order_nsu,
      foundBy
    });

    // Helper function to update payment to paid (uses centralized RPC)
    const updateToPaid = async () => {
      console.log('💳 Atualizando pagamento para PAGO via RPC');
      
      const { data: rpcResult, error: rpcError } = await supabase.rpc('finalize_gallery_payment', {
        p_cobranca_id: cobranca.id,
        p_receipt_url: receiptUrl || null,
        p_paid_at: new Date().toISOString(),
      });

      if (rpcError) {
        console.error('❌ RPC finalize_gallery_payment error:', rpcError);
        return { success: false, error: rpcError.message };
      }

      console.log('✅ finalize_gallery_payment result:', JSON.stringify(rpcResult));
      return { success: true, result: rpcResult };
    };

    // If already paid, auto-heal: ensure gallery/session are synced
    if (cobranca.status === 'pago') {
      console.log('💳 Cobrança já paga — chamando finalize_gallery_payment para auto-heal de galeria/sessão');
      const { data: healResult, error: healError } = await supabase.rpc('finalize_gallery_payment', {
        p_cobranca_id: cobranca.id,
        p_receipt_url: cobranca.ip_receipt_url || null,
        p_paid_at: cobranca.data_pagamento || new Date().toISOString(),
      });
      if (healError) {
        console.error('⚠️ Auto-heal RPC error (non-blocking):', healError.message);
      } else if (healResult?.gallery_synced) {
        console.log('✅ Auto-heal: galeria sincronizada com sucesso');
      }

      return new Response(
        JSON.stringify({
          found: true,
          status: 'pago',
          foundBy,
          gallerySynced: healResult?.gallery_synced || false,
          cobranca: {
            id: cobranca.id,
            status: cobranca.status,
            valor: cobranca.valor,
            provedor: cobranca.provedor,
            dataPagamento: cobranca.data_pagamento,
            receiptUrl: cobranca.ip_receipt_url,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // LAYER 3: If pending and InfinitePay, check real status via public API
    // Priority: Use redirect parameters (transactionNsu, slug) if available
    if (cobranca.status === 'pendente' && cobranca.provedor === 'infinitepay' && cobranca.ip_order_nsu) {
      console.log('🔄 Status pendente - verificando na API pública InfinitePay...');
      
      const ipResult = await checkInfinitePayStatusPublic(
        supabase,
        cobranca.user_id,
        cobranca.ip_order_nsu,
        transactionNsu,
        slug
      );
      
      if (ipResult.status === 'paid') {
        console.log('💰 InfinitePay confirmou pagamento via API pública - atualizando banco...');
        
        // Save gateway-specific metadata BEFORE RPC (RPC handles status/data_pagamento)
        if (transactionNsu || receiptUrl || ipResult.receiptUrl) {
          const metaData: Record<string, unknown> = {};
          if (transactionNsu) metaData.ip_transaction_nsu = transactionNsu;
          if (receiptUrl || ipResult.receiptUrl) metaData.ip_receipt_url = receiptUrl || ipResult.receiptUrl;
          
          await supabase
            .from('cobrancas')
            .update(metaData)
            .eq('id', cobranca.id);
        }
        
        // Also update gallery and session
        const updateResult = await updateToPaid();
        
        if (updateResult.success) {
          return new Response(
            JSON.stringify({
              found: true,
              status: 'pago',
              updated: true,
              source: 'infinitepay_public_api',
              foundBy,
              message: 'Pagamento confirmado via API pública InfinitePay',
              cobranca: {
                id: cobranca.id,
                status: 'pago',
                valor: cobranca.valor,
                provedor: cobranca.provedor,
                dataPagamento: new Date().toISOString(),
                receiptUrl: receiptUrl || ipResult.receiptUrl,
              },
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // If forceUpdate is true and status is pending, manually mark as paid
    // This is useful for redirect detection (LAYER 2) when client returns from checkout
    if (forceUpdate && cobranca.status === 'pendente') {
      console.log('⚡ Forçando atualização para pago (forceUpdate=true)');

      // Save transaction data from redirect if available
      if (transactionNsu || receiptUrl) {
        const updateData: Record<string, unknown> = {};
        if (transactionNsu) updateData.ip_transaction_nsu = transactionNsu;
        if (receiptUrl) updateData.ip_receipt_url = receiptUrl;
        
        if (Object.keys(updateData).length > 0) {
          await supabase
            .from('cobrancas')
            .update(updateData)
            .eq('id', cobranca.id);
          console.log('📝 Dados do redirect salvos:', updateData);
        }
      }

      const updateResult = await updateToPaid();
      
      if (!updateResult.success) {
        return new Response(
          JSON.stringify({ error: 'Erro ao atualizar cobrança', details: updateResult.error }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          found: true,
          status: 'pago',
          updated: true,
          source: 'force_update',
          foundBy,
          message: 'Pagamento confirmado via redirect',
          cobranca: {
            id: cobranca.id,
            status: 'pago',
            valor: cobranca.valor,
            provedor: cobranca.provedor,
            dataPagamento: new Date().toISOString(),
            receiptUrl: receiptUrl,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return current status without modification
    return new Response(
      JSON.stringify({
        found: true,
        status: cobranca.status,
        foundBy,
        cobranca: {
          id: cobranca.id,
          status: cobranca.status,
          valor: cobranca.valor,
          provedor: cobranca.provedor,
          checkoutUrl: cobranca.ip_checkout_url,
          orderNsu: cobranca.ip_order_nsu,
          createdAt: cobranca.created_at,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Erro interno:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
