import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  clienteId: string;
  sessionId?: string;
  valor: number;
  descricao: string;
  userId: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { clienteId, sessionId, valor, descricao, userId }: RequestBody = await req.json();

    // Validate required fields
    if (!clienteId || !valor || !userId) {
      return new Response(
        JSON.stringify({ error: 'clienteId, valor e userId são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Fetch InfinitePay handle from user integrations
    const { data: integracao, error: integracaoError } = await supabase
      .from('usuarios_integracoes')
      .select('dados_extras')
      .eq('user_id', userId)
      .eq('provedor', 'infinitepay')
      .eq('status', 'ativo')
      .maybeSingle();

    if (integracaoError) {
      console.error('Integration fetch error:', integracaoError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar integração InfinitePay' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const handle = (integracao?.dados_extras as { handle?: string })?.handle;

    if (!handle) {
      return new Response(
        JSON.stringify({ error: 'InfinitePay não configurado para este usuário' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Generate InfinitePay checkout URL
    // The InfinitePay checkout URL format: https://checkout.infinitepay.io/{handle}?amount={cents}&description={desc}
    const valorCentavos = Math.round(valor * 100);
    const checkoutUrl = `https://checkout.infinitepay.io/${handle}?amount=${valorCentavos}&description=${encodeURIComponent(descricao)}`;

    console.log(`💳 Generated InfinitePay checkout: ${checkoutUrl}`);

    // 3. Create charge record in database
    const { data: cobranca, error: cobrancaError } = await supabase
      .from('cobrancas')
      .insert({
        user_id: userId,
        cliente_id: clienteId,
        session_id: sessionId || null,
        valor,
        descricao,
        tipo_cobranca: 'foto_extra',
        provedor: 'infinitepay',
        status: 'pendente',
        ip_checkout_url: checkoutUrl,
      })
      .select('id')
      .single();

    if (cobrancaError) {
      console.error('Charge creation error:', cobrancaError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar registro de cobrança' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ InfinitePay charge created: ${cobranca.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        checkoutUrl,
        cobrancaId: cobranca.id,
        provedor: 'infinitepay',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('InfinitePay create link error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
