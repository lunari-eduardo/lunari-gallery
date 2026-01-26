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
  redirectUrl?: string;
  webhookUrl?: string;
  galleryToken?: string;
}

interface InfinitePayItem {
  quantity: number;
  price: number; // in centavos
  description: string;
}

interface InfinitePayPayload {
  handle: string;
  items: InfinitePayItem[];
  order_nsu?: string;
  redirect_url?: string;
  webhook_url?: string;
  customer?: {
    name?: string;
    email?: string;
    phone_number?: string;
  };
}

interface InfinitePayResponse {
  url?: string;           // Campo retornado pela API InfinitePay
  checkout_url?: string;  // Fallback para compatibilidade
  slug?: string;
  error?: string;
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

    const { clienteId, sessionId, valor, descricao, userId, redirectUrl, webhookUrl, galleryToken }: RequestBody = await req.json();

    // Validate required fields
    if (!clienteId || !valor || !userId) {
      console.error('Missing required fields:', { clienteId, valor, userId });
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
      console.error('No InfinitePay handle found for user:', userId);
      return new Response(
        JSON.stringify({ error: 'InfinitePay não configurado para este usuário' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Generate unique order_nsu for tracking
    const orderNsu = `gallery-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // 3. Convert value to centavos (InfinitePay expects price in centavos)
    const valorCentavos = Math.round(valor * 100);

    // 4. Build InfinitePay payload according to official API docs
    const infinitePayload: InfinitePayPayload = {
      handle: handle,
      items: [
        {
          quantity: 1,
          price: valorCentavos,
          description: descricao.substring(0, 100), // Limit description length
        }
      ],
      order_nsu: orderNsu,
    };

    // Add redirect URL - build from gallery token if available
    if (redirectUrl) {
      infinitePayload.redirect_url = redirectUrl;
    } else if (galleryToken) {
      // Build redirect URL to gallery with payment success parameter
      // Using the production URL pattern
      const baseUrl = 'https://lunari-gallery.lovable.app';
      infinitePayload.redirect_url = `${baseUrl}/g/${galleryToken}?payment=success`;
      console.log(`💳 Redirect URL configurada: ${infinitePayload.redirect_url}`);
    }

    // Add webhook URL for payment notifications
    if (webhookUrl) {
      infinitePayload.webhook_url = webhookUrl;
    } else {
      // Default webhook URL pointing to our edge function
      infinitePayload.webhook_url = `${supabaseUrl}/functions/v1/infinitepay-webhook`;
    }
    
    console.log(`💳 Webhook URL configurada: ${infinitePayload.webhook_url}`);

    console.log(`💳 Calling InfinitePay API with payload:`, JSON.stringify(infinitePayload));

    // 5. Call InfinitePay API to create checkout link
    const infinitePayResponse = await fetch('https://api.infinitepay.io/invoices/public/checkout/links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(infinitePayload),
    });

    const responseText = await infinitePayResponse.text();
    console.log(`💳 InfinitePay API response status: ${infinitePayResponse.status}`);
    console.log(`💳 InfinitePay API response body: ${responseText}`);

    if (!infinitePayResponse.ok) {
      console.error('InfinitePay API error:', responseText);
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao criar link de pagamento InfinitePay',
          details: responseText 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let infinitePayData: InfinitePayResponse;
    try {
      infinitePayData = JSON.parse(responseText);
    } catch {
      console.error('Failed to parse InfinitePay response:', responseText);
      return new Response(
        JSON.stringify({ error: 'Resposta inválida da InfinitePay' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use 'url' (API atual) com fallback para 'checkout_url'
    const checkoutUrl = infinitePayData.url || infinitePayData.checkout_url;
    const invoiceSlug = infinitePayData.slug;

    if (!checkoutUrl) {
      console.error('No checkout_url in InfinitePay response:', infinitePayData);
      return new Response(
        JSON.stringify({ error: 'InfinitePay não retornou URL de checkout' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`💳 InfinitePay checkout URL generated: ${checkoutUrl}`);

    // 6. Create charge record in database
    const { data: cobranca, error: cobrancaError } = await supabase
      .from('cobrancas')
      .insert({
        user_id: userId,
        cliente_id: clienteId,
        session_id: sessionId || null,
        valor,
        descricao,
        tipo_cobranca: 'link',
        provedor: 'infinitepay',
        status: 'pendente',
        ip_checkout_url: checkoutUrl,
        ip_order_nsu: orderNsu,
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

    console.log(`✅ InfinitePay charge created: ${cobranca.id} with order_nsu: ${orderNsu}`);

    return new Response(
      JSON.stringify({
        success: true,
        checkoutUrl,
        cobrancaId: cobranca.id,
        orderNsu,
        invoiceSlug,
        provedor: 'infinitepay',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('InfinitePay create link error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
