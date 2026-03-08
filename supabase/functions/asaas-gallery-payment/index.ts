import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface RequestBody {
  userId: string;
  clienteId?: string;
  sessionId?: string;
  valor: number;
  descricao?: string;
  galeriaId?: string;
  qtdFotos?: number;
  galleryToken?: string;
  billingType?: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
  // For transparent checkout (credit card)
  creditCard?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  creditCardHolderInfo?: {
    name: string;
    cpfCnpj: string;
    email: string;
    phone: string;
    postalCode: string;
    addressNumber: string;
  };
  remoteIp?: string;
  installmentCount?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();
    const { userId, clienteId, sessionId, valor, descricao, galeriaId, qtdFotos, galleryToken, billingType } = body;

    if (!userId || !valor || valor <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'userId e valor são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Fetch photographer's Asaas integration
    const { data: integracao, error: integError } = await supabase
      .from('usuarios_integracoes')
      .select('access_token, dados_extras')
      .eq('user_id', userId)
      .eq('provedor', 'asaas')
      .eq('status', 'ativo')
      .maybeSingle();

    if (integError || !integracao?.access_token) {
      console.error('Asaas integration not found:', integError);
      return new Response(
        JSON.stringify({ success: false, error: 'Integração Asaas não configurada', code: 'ASAAS_NOT_CONFIGURED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const asaasApiKey = integracao.access_token;
    const settings = (integracao.dados_extras || {}) as {
      environment?: string;
      habilitarPix?: boolean;
      habilitarCartao?: boolean;
      habilitarBoleto?: boolean;
      maxParcelas?: number;
      absorverTaxa?: boolean;
      taxaAntecipacao?: boolean;
      taxaAntecipacaoPercentual?: number;
    };

    const asaasBaseUrl = settings.environment === 'production'
      ? 'https://api.asaas.com'
      : 'https://api-sandbox.asaas.com';

    // Determine billing type
    const finalBillingType = billingType || (settings.habilitarPix ? 'PIX' : settings.habilitarCartao ? 'CREDIT_CARD' : 'BOLETO');

    // Validate billing type is enabled
    if (finalBillingType === 'PIX' && !settings.habilitarPix) {
      return new Response(
        JSON.stringify({ success: false, error: 'PIX não está habilitado', code: 'PIX_DISABLED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (finalBillingType === 'CREDIT_CARD' && !settings.habilitarCartao) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cartão de crédito não está habilitado', code: 'CARD_DISABLED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (finalBillingType === 'BOLETO' && !settings.habilitarBoleto) {
      return new Response(
        JSON.stringify({ success: false, error: 'Boleto não está habilitado', code: 'BOLETO_DISABLED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Find or create Asaas customer
    let asaasCustomerId: string | null = null;

    // Check if client has an asaas_customer_id stored
    if (clienteId) {
      const { data: cliente } = await supabase
        .from('clientes')
        .select('nome, email, telefone')
        .eq('id', clienteId)
        .maybeSingle();

      if (cliente) {
        // Search for existing customer by email in Asaas
        if (cliente.email) {
          const searchResp = await fetch(`${asaasBaseUrl}/v3/customers?email=${encodeURIComponent(cliente.email)}`, {
            headers: { access_token: asaasApiKey },
          });
          if (searchResp.ok) {
            const searchData = await searchResp.json();
            if (searchData.data && searchData.data.length > 0) {
              asaasCustomerId = searchData.data[0].id;
              console.log(`📋 Found existing Asaas customer: ${asaasCustomerId}`);
            }
          }
        }

        // Create new customer if not found
        if (!asaasCustomerId) {
          const createResp = await fetch(`${asaasBaseUrl}/v3/customers`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              access_token: asaasApiKey,
            },
            body: JSON.stringify({
              name: cliente.nome || 'Cliente',
              email: cliente.email || undefined,
              phone: cliente.telefone || undefined,
              externalReference: clienteId,
            }),
          });

          if (createResp.ok) {
            const createData = await createResp.json();
            asaasCustomerId = createData.id;
            console.log(`📋 Created Asaas customer: ${asaasCustomerId}`);
          } else {
            const errData = await createResp.json();
            console.error('Failed to create Asaas customer:', errData);
            // Continue without customer - Asaas allows it for some billing types
          }
        }
      }
    }

    // If no customer found/created, create a generic one
    if (!asaasCustomerId) {
      const createResp = await fetch(`${asaasBaseUrl}/v3/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          access_token: asaasApiKey,
        },
        body: JSON.stringify({
          name: 'Cliente Galeria',
          externalReference: galeriaId || 'gallery-client',
        }),
      });

      if (createResp.ok) {
        const createData = await createResp.json();
        asaasCustomerId = createData.id;
      } else {
        const errData = await createResp.json();
        console.error('Failed to create fallback Asaas customer:', errData);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao criar cliente no Asaas', code: 'ASAAS_CUSTOMER_ERROR' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 3. Create payment in Asaas
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3); // 3 days from now

    const paymentBody: Record<string, unknown> = {
      customer: asaasCustomerId,
      billingType: finalBillingType,
      value: valor,
      dueDate: dueDate.toISOString().split('T')[0],
      description: descricao || 'Pagamento galeria de fotos',
      externalReference: galeriaId || undefined,
    };

    // Fee settings
    if (settings.absorverTaxa) {
      // When photographer absorbs fees, split settings are not needed
      // The value charged is the full value
    }

    // Installment settings for credit card
    if (finalBillingType === 'CREDIT_CARD' && body.installmentCount && body.installmentCount > 1) {
      const maxParcelas = settings.maxParcelas || 12;
      paymentBody.installmentCount = Math.min(body.installmentCount, maxParcelas);
      paymentBody.installmentValue = valor / (paymentBody.installmentCount as number);
    }

    // Credit card data for transparent checkout
    if (finalBillingType === 'CREDIT_CARD' && body.creditCard) {
      paymentBody.creditCard = body.creditCard;
      paymentBody.creditCardHolderInfo = body.creditCardHolderInfo;
      if (body.remoteIp) {
        paymentBody.remoteIp = body.remoteIp;
      }
    }

    console.log(`💳 Creating Asaas payment: ${finalBillingType}, R$ ${valor}, customer: ${asaasCustomerId}`);

    const paymentResp = await fetch(`${asaasBaseUrl}/v3/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        access_token: asaasApiKey,
      },
      body: JSON.stringify(paymentBody),
    });

    const paymentData = await paymentResp.json();

    if (!paymentResp.ok) {
      const errorMsg = paymentData.errors?.[0]?.description || 'Erro ao criar pagamento no Asaas';
      console.error('Asaas payment creation error:', paymentData);
      return new Response(
        JSON.stringify({ success: false, error: errorMsg, code: 'ASAAS_PAYMENT_ERROR' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Asaas payment created: ${paymentData.id}, status: ${paymentData.status}`);

    // 4. Get PIX QR code if billing type is PIX
    let pixData: { encodedImage?: string; payload?: string; expirationDate?: string } | null = null;
    if (finalBillingType === 'PIX') {
      const pixResp = await fetch(`${asaasBaseUrl}/v3/payments/${paymentData.id}/pixQrCode`, {
        headers: { access_token: asaasApiKey },
      });
      if (pixResp.ok) {
        pixData = await pixResp.json();
        console.log('📱 PIX QR code generated');
      } else {
        console.warn('Failed to get PIX QR code:', await pixResp.text());
      }
    }

    // 5. Get boleto URL if billing type is BOLETO
    let boletoUrl: string | null = null;
    if (finalBillingType === 'BOLETO') {
      boletoUrl = paymentData.bankSlipUrl || null;
    }

    // 6. Save cobrança in database
    const cobrancaData: Record<string, unknown> = {
      user_id: userId,
      cliente_id: clienteId || null,
      session_id: sessionId || null,
      galeria_id: galeriaId || null,
      valor: valor,
      status: paymentData.status === 'CONFIRMED' || paymentData.status === 'RECEIVED' ? 'pago' : 'pendente',
      provedor: 'asaas',
      tipo_cobranca: 'foto_extra',
      descricao: descricao || 'Pagamento galeria',
      qtd_fotos: qtdFotos || 0,
      mp_payment_id: paymentData.id, // Reuse mp_payment_id column for Asaas payment ID
    };

    if (finalBillingType === 'PIX' && pixData) {
      cobrancaData.mp_qr_code_base64 = pixData.encodedImage;
      cobrancaData.mp_pix_copia_cola = pixData.payload;
    }

    if (finalBillingType === 'BOLETO' && boletoUrl) {
      cobrancaData.ip_checkout_url = boletoUrl; // Reuse for boleto URL
    }

    const { data: cobranca, error: cobrancaError } = await supabase
      .from('cobrancas')
      .insert(cobrancaData)
      .select('id')
      .single();

    if (cobrancaError) {
      console.error('Error saving cobrança:', cobrancaError);
      // Payment was created in Asaas but we failed to save locally - log but don't fail
    }

    // 7. Build checkout URL for redirect-based flow
    const checkoutUrl = paymentData.invoiceUrl || null;

    // 8. Build response
    const response: Record<string, unknown> = {
      success: true,
      cobrancaId: cobranca?.id,
      asaasPaymentId: paymentData.id,
      provedor: 'asaas',
      billingType: finalBillingType,
      status: paymentData.status,
      checkoutUrl,
    };

    if (finalBillingType === 'PIX' && pixData) {
      response.pixQrCode = pixData.encodedImage;
      response.pixCopiaECola = pixData.payload;
      response.pixExpirationDate = pixData.expirationDate;
    }

    if (finalBillingType === 'BOLETO') {
      response.boletoUrl = boletoUrl;
    }

    if (finalBillingType === 'CREDIT_CARD') {
      response.creditCardStatus = paymentData.status;
      // Credit card payments can be confirmed immediately
      if (paymentData.status === 'CONFIRMED' || paymentData.status === 'RECEIVED') {
        response.paid = true;
      }
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Asaas gallery payment error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
