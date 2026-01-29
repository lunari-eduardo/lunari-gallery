import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateLinkRequest {
  cobranca_id: string;
  photographer_id: string;
  valor: number;
  descricao: string;
  cliente_email: string;
  payment_method: 'pix' | 'credit_card';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body: CreateLinkRequest = await req.json();
    const { cobranca_id, photographer_id, valor, descricao, cliente_email, payment_method } = body;

    console.log('Criando pagamento MP para fotógrafo:', photographer_id, 'cobrança:', cobranca_id);

    // 1. Get photographer's Mercado Pago credentials
    const { data: integracao, error: integracaoError } = await supabase
      .from('usuarios_integracoes')
      .select('access_token, dados_extras, expira_em, refresh_token')
      .eq('user_id', photographer_id)
      .eq('provedor', 'mercadopago')
      .eq('status', 'ativo')
      .single();

    if (integracaoError || !integracao) {
      console.error('Fotógrafo não tem Mercado Pago configurado:', integracaoError);
      return new Response(
        JSON.stringify({ error: 'Fotógrafo não tem Mercado Pago configurado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token is expired and needs refresh
    const expiresAt = new Date(integracao.expira_em);
    const now = new Date();
    const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    if (daysUntilExpiry < 7) {
      // Token is close to expiring, try to refresh
      console.log('Token próximo de expirar, tentando renovar...');
      const mpAppId = Deno.env.get('MERCADOPAGO_APP_ID');
      const mpAppSecret = Deno.env.get('MERCADOPAGO_APP_SECRET');

      if (mpAppId && mpAppSecret && integracao.refresh_token) {
        try {
          const refreshResponse = await fetch('https://api.mercadopago.com/oauth/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              client_id: mpAppId,
              client_secret: mpAppSecret,
              grant_type: 'refresh_token',
              refresh_token: integracao.refresh_token,
            }),
          });

          if (refreshResponse.ok) {
            const newTokenData = await refreshResponse.json();
            const newExpiresAt = new Date(Date.now() + newTokenData.expires_in * 1000).toISOString();

            await supabase
              .from('usuarios_integracoes')
              .update({
                access_token: newTokenData.access_token,
                refresh_token: newTokenData.refresh_token,
                expira_em: newExpiresAt,
              })
              .eq('user_id', photographer_id)
              .eq('provedor', 'mercadopago');

            integracao.access_token = newTokenData.access_token;
            console.log('Token renovado com sucesso');
          }
        } catch (refreshError) {
          console.error('Erro ao renovar token:', refreshError);
        }
      }
    }

    const photographerToken = integracao.access_token;
    const settings = integracao.dados_extras as {
      habilitarPix?: boolean;
      habilitarCartao?: boolean;
      maxParcelas?: number;
      absorverTaxa?: boolean;
    } | null;

    // Validate payment method is enabled
    if (payment_method === 'pix' && settings?.habilitarPix === false) {
      return new Response(
        JSON.stringify({ error: 'PIX não está habilitado para este fotógrafo' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (payment_method === 'credit_card' && settings?.habilitarCartao === false) {
      return new Response(
        JSON.stringify({ error: 'Cartão não está habilitado para este fotógrafo' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Create payment using photographer's token
    if (payment_method === 'pix') {
      // Create PIX payment
      const pixPayload = {
        transaction_amount: valor,
        description: descricao,
        payment_method_id: 'pix',
        payer: {
          email: cliente_email,
        },
        external_reference: cobranca_id,
      };

      console.log('Criando PIX com payload:', JSON.stringify(pixPayload));

      const paymentResponse = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${photographerToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `pix-${cobranca_id}`,
        },
        body: JSON.stringify(pixPayload),
      });

      if (!paymentResponse.ok) {
        const errorText = await paymentResponse.text();
        console.error('Erro ao criar pagamento PIX:', errorText);
        return new Response(
          JSON.stringify({ error: 'Erro ao criar pagamento', details: errorText }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const paymentData = await paymentResponse.json();
      console.log('Pagamento PIX criado:', paymentData.id);

      // Update cobranca with PIX data
      const { error: updateError } = await supabase
        .from('cobrancas')
        .update({
          mp_payment_id: String(paymentData.id),
          mp_qr_code: paymentData.point_of_interaction?.transaction_data?.qr_code,
          mp_qr_code_base64: paymentData.point_of_interaction?.transaction_data?.qr_code_base64,
          mp_pix_copia_cola: paymentData.point_of_interaction?.transaction_data?.qr_code,
          mp_expiration_date: paymentData.date_of_expiration,
          provedor: 'mercadopago',
          status: 'pendente',
        })
        .eq('id', cobranca_id);

      if (updateError) {
        console.error('Erro ao atualizar cobrança:', updateError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          payment_id: paymentData.id,
          payment_method: 'pix',
          qr_code: paymentData.point_of_interaction?.transaction_data?.qr_code,
          qr_code_base64: paymentData.point_of_interaction?.transaction_data?.qr_code_base64,
          expiration_date: paymentData.date_of_expiration,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      // Create preference for card payment (checkout redirect)
      const maxParcelas = settings?.maxParcelas || 12;
      
      const preferencePayload = {
        items: [{
          title: descricao,
          quantity: 1,
          unit_price: valor,
          currency_id: 'BRL',
        }],
        payer: {
          email: cliente_email,
        },
        external_reference: cobranca_id,
        payment_methods: {
          excluded_payment_types: [{ id: 'ticket' }],
          installments: maxParcelas,
        },
        back_urls: {
          success: `https://gallery.lunarihub.com/payment/success?ref=${cobranca_id}`,
          failure: `https://gallery.lunarihub.com/payment/failure?ref=${cobranca_id}`,
          pending: `https://gallery.lunarihub.com/payment/pending?ref=${cobranca_id}`,
        },
        auto_return: 'approved',
      };

      console.log('Criando preferência de cartão');

      const preferenceResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${photographerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferencePayload),
      });

      if (!preferenceResponse.ok) {
        const errorText = await preferenceResponse.text();
        console.error('Erro ao criar preferência:', errorText);
        return new Response(
          JSON.stringify({ error: 'Erro ao criar checkout', details: errorText }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const preferenceData = await preferenceResponse.json();
      console.log('Preferência criada:', preferenceData.id);

      // Update cobranca with preference data
      const { error: updateError } = await supabase
        .from('cobrancas')
        .update({
          mp_preference_id: preferenceData.id,
          mp_payment_link: preferenceData.init_point,
          provedor: 'mercadopago',
          status: 'pendente',
        })
        .eq('id', cobranca_id);

      if (updateError) {
        console.error('Erro ao atualizar cobrança:', updateError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          preference_id: preferenceData.id,
          payment_method: 'credit_card',
          checkout_url: preferenceData.init_point,
          sandbox_url: preferenceData.sandbox_init_point,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Erro ao criar link de pagamento:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao processar pagamento' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
