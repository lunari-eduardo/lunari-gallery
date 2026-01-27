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
}

// LAYER 3: Query InfinitePay API to check real payment status
async function checkInfinitePayStatus(orderNsu: string): Promise<'paid' | 'pending' | 'error'> {
  const clientId = Deno.env.get('INFINITEPAY_CLIENT_ID');
  const clientSecret = Deno.env.get('INFINITEPAY_CLIENT_SECRET');
  
  if (!clientId || !clientSecret) {
    console.log('⚠️ InfinitePay credentials not configured, skipping API check');
    return 'error';
  }
  
  try {
    console.log('🔍 Consultando status na API InfinitePay para order_nsu:', orderNsu);
    
    // InfinitePay Orders API endpoint
    const response = await fetch(`https://api.infinitepay.io/v2/orders/${orderNsu}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('⚠️ InfinitePay API retornou erro:', response.status, errorText);
      return 'error';
    }
    
    const data = await response.json();
    console.log('📊 Resposta InfinitePay:', JSON.stringify(data));
    
    // Check if payment is confirmed
    const status = data.status?.toLowerCase() || '';
    if (status === 'paid' || status === 'approved' || status === 'confirmed' || status === 'completed') {
      console.log('✅ Pagamento CONFIRMADO na InfinitePay');
      return 'paid';
    }
    
    console.log('⏳ Pagamento ainda PENDENTE na InfinitePay:', status);
    return 'pending';
  } catch (error) {
    console.error('❌ Erro ao consultar InfinitePay API:', error);
    return 'error';
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
    const { cobrancaId, orderNsu, sessionId, forceUpdate } = body;

    console.log('🔍 Verificando status de pagamento:', { cobrancaId, orderNsu, sessionId, forceUpdate });

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
      const { data, error } = await supabase
        .from('cobrancas')
        .select('*')
        .eq('session_id', sessionId)
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

    // Helper function to update payment to paid
    const updateToPaid = async () => {
      console.log('💳 Atualizando pagamento para PAGO');
      
      // 1. Update cobranca status
      const { error: updateCobrancaError } = await supabase
        .from('cobrancas')
        .update({
          status: 'pago',
          data_pagamento: new Date().toISOString(),
        })
        .eq('id', cobranca.id);

      if (updateCobrancaError) {
        console.error('❌ Erro ao atualizar cobrança:', updateCobrancaError);
        return { success: false, error: updateCobrancaError.message };
      }
      console.log('✅ Cobrança atualizada para pago');

      // 2. Update gallery payment status if session_id exists
      if (cobranca.session_id) {
        const { data: galeria } = await supabase
          .from('galerias')
          .select('id')
          .eq('session_id', cobranca.session_id)
          .maybeSingle();

        if (galeria) {
          await supabase
            .from('galerias')
            .update({ status_pagamento: 'pago' })
            .eq('id', galeria.id);
          console.log('✅ Galeria atualizada para pago');
        }

        // 3. Update clientes_sessoes.valor_pago (increment)
        const { data: sessao } = await supabase
          .from('clientes_sessoes')
          .select('valor_pago')
          .eq('session_id', cobranca.session_id)
          .maybeSingle();

        if (sessao) {
          const valorAtual = Number(sessao.valor_pago) || 0;
          const valorCobranca = Number(cobranca.valor) || 0;
          const novoValorPago = valorAtual + valorCobranca;

          await supabase
            .from('clientes_sessoes')
            .update({ valor_pago: novoValorPago })
            .eq('session_id', cobranca.session_id);
          console.log(`✅ Sessão valor_pago atualizado: ${valorAtual} + ${valorCobranca} = ${novoValorPago}`);
        }
      }

      return { success: true };
    };

    // If already paid, just return the status
    if (cobranca.status === 'pago') {
      return new Response(
        JSON.stringify({
          found: true,
          status: 'pago',
          foundBy,
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

    // LAYER 3: If pending and InfinitePay, check real status via API
    if (cobranca.status === 'pendente' && cobranca.provedor === 'infinitepay' && cobranca.ip_order_nsu) {
      console.log('🔄 Status pendente - verificando na API InfinitePay...');
      
      const ipStatus = await checkInfinitePayStatus(cobranca.ip_order_nsu);
      
      if (ipStatus === 'paid') {
        console.log('💰 InfinitePay confirmou pagamento - atualizando banco...');
        
        const updateResult = await updateToPaid();
        
        if (updateResult.success) {
          return new Response(
            JSON.stringify({
              found: true,
              status: 'pago',
              updated: true,
              source: 'infinitepay_api',
              foundBy,
              message: 'Pagamento confirmado via API InfinitePay',
              cobranca: {
                id: cobranca.id,
                status: 'pago',
                valor: cobranca.valor,
                provedor: cobranca.provedor,
                dataPagamento: new Date().toISOString(),
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
