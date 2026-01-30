import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Interface flexível que aceita ambos os formatos de chamada
interface CreateLinkRequest {
  // Formato original (chamadas diretas)
  cobranca_id?: string;
  photographer_id?: string;
  cliente_email?: string;
  payment_method?: 'pix' | 'credit_card';
  
  // Formato confirm-selection (Gallery flow)
  userId?: string;
  clienteId?: string;
  galeriaId?: string;
  galleryToken?: string;
  qtdFotos?: number;
  sessionId?: string;
  
  // Campos comuns
  valor: number;
  descricao: string;
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
    
    // === NORMALIZAÇÃO DE PARÂMETROS ===
    
    // 1. Identificar photographer_id (aceita ambos os nomes)
    const photographerId = body.photographer_id || body.userId;
    
    if (!photographerId) {
      console.error('Nenhum ID de fotógrafo fornecido (photographer_id ou userId)');
      return new Response(
        JSON.stringify({ success: false, error: 'ID do fotógrafo é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === VALIDAÇÃO ROBUSTA: Requer cliente OU galeria ===
    if (!body.clienteId && !body.galeriaId && !body.cobranca_id) {
      console.error('Cobrança requer cliente_id, galeria_id ou cobranca_id existente');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'É necessário um cliente ou galeria vinculada para criar cobrança' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log informativo para galerias públicas
    if (!body.clienteId && body.galeriaId) {
      console.log('⚠️ Criando cobrança para galeria pública (sem cliente vinculado)');
    }
    
    console.log('Criando pagamento MP para fotógrafo:', photographerId, 'galeriaId:', body.galeriaId, 'clienteId:', body.clienteId || 'NULL');
    
    // 2. Buscar email do cliente se não fornecido
    let clienteEmail = body.cliente_email;
    if (!clienteEmail && body.clienteId) {
      const { data: cliente } = await supabase
        .from('clientes')
        .select('email')
        .eq('id', body.clienteId)
        .single();
      
      clienteEmail = cliente?.email || 'cliente@email.com';
      console.log('Email do cliente obtido via clienteId:', clienteEmail);
    }
    
    if (!clienteEmail) {
      clienteEmail = 'cliente@email.com'; // Fallback para galerias públicas
      console.log('Usando email fallback:', clienteEmail);
    }
    
    // 3. Criar cobrança se não fornecida (aceita cliente_id NULL agora)
    let cobrancaId = body.cobranca_id;
    if (!cobrancaId && body.galeriaId) {
      console.log('Criando nova cobrança para galeria:', body.galeriaId);
      
      const { data: novaCobranca, error: cobrancaError } = await supabase
        .from('cobrancas')
        .insert({
          user_id: photographerId,
          cliente_id: body.clienteId || null, // Permite NULL para galerias públicas
          galeria_id: body.galeriaId,
          session_id: body.sessionId || null,
          valor: body.valor,
          descricao: body.descricao,
          tipo_cobranca: 'link',
          qtd_fotos: body.qtdFotos || 0,
          status: 'pendente',
          provedor: 'mercadopago',
        })
        .select('id')
        .single();
      
      if (cobrancaError) {
        console.error('Erro ao criar cobrança:', cobrancaError);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao criar cobrança', details: cobrancaError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      cobrancaId = novaCobranca.id;
      console.log('Cobrança criada com ID:', cobrancaId);
    }
    
    if (!cobrancaId) {
      console.error('Nenhum cobranca_id fornecido e não foi possível criar');
      return new Response(
        JSON.stringify({ success: false, error: 'ID da cobrança é obrigatório ou galeriaId para criar uma nova' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Get photographer's Mercado Pago credentials
    const { data: integracao, error: integracaoError } = await supabase
      .from('usuarios_integracoes')
      .select('access_token, dados_extras, expira_em, refresh_token')
      .eq('user_id', photographerId)
      .eq('provedor', 'mercadopago')
      .eq('status', 'ativo')
      .single();

    if (integracaoError || !integracao) {
      console.error('Fotógrafo não tem Mercado Pago configurado:', integracaoError);
      return new Response(
        JSON.stringify({ success: false, error: 'Fotógrafo não tem Mercado Pago configurado' }),
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
              .eq('user_id', photographerId)
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

    // 5. Determinar método de pagamento baseado nas configurações
    let paymentMethod = body.payment_method;
    
    // === LÓGICA DE MÉTODOS DE PAGAMENTO CONFORME CONFIGURAÇÃO ===
    const pixHabilitado = settings?.habilitarPix !== false; // Default true
    const cartaoHabilitado = settings?.habilitarCartao !== false; // Default true
    
    console.log(`📋 Configurações de pagamento: PIX=${pixHabilitado}, Cartão=${cartaoHabilitado}`);
    
    // Validate payment method is enabled (if specified)
    if (paymentMethod === 'pix' && !pixHabilitado) {
      return new Response(
        JSON.stringify({ success: false, error: 'PIX não está habilitado para este fotógrafo' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (paymentMethod === 'credit_card' && !cartaoHabilitado) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cartão não está habilitado para este fotógrafo' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se nenhum método foi especificado e só PIX está habilitado, força PIX direto
    if (!paymentMethod && pixHabilitado && !cartaoHabilitado) {
      console.log('📱 Apenas PIX habilitado - criando pagamento PIX direto');
      paymentMethod = 'pix';
    }

    // 6. Criar pagamento baseado no método (ou checkout genérico se não especificado)
    if (paymentMethod === 'pix') {
      // Create PIX payment
      const pixPayload = {
        transaction_amount: body.valor,
        description: body.descricao,
        payment_method_id: 'pix',
        payer: {
          email: clienteEmail,
        },
        external_reference: cobrancaId,
      };

      console.log('Criando PIX com payload:', JSON.stringify(pixPayload));

      const paymentResponse = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${photographerToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `pix-${cobrancaId}`,
        },
        body: JSON.stringify(pixPayload),
      });

      if (!paymentResponse.ok) {
        const errorText = await paymentResponse.text();
        console.error('Erro ao criar pagamento PIX:', errorText);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao criar pagamento', details: errorText }),
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
        .eq('id', cobrancaId);

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
          // Campos padronizados (camelCase)
          cobrancaId: cobrancaId,
          cobranca: { id: cobrancaId },
          provedor: 'mercadopago',
          // Alias para compatibilidade
          cobranca_id: cobrancaId,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      // Create preference for card payment OR generic checkout (accepts both PIX and card)
      const maxParcelas = settings?.maxParcelas || 12;
      
      // Construir lista de métodos de pagamento excluídos
      const excludedTypes: { id: string }[] = [{ id: 'ticket' }]; // Sempre excluir boleto
      
      // Excluir cartão se desabilitado nas configurações
      if (!cartaoHabilitado) {
        excludedTypes.push({ id: 'credit_card' });
        excludedTypes.push({ id: 'debit_card' });
        console.log('💳 Cartão desabilitado - excluindo do checkout');
      }
      
      // Se cartão específico foi solicitado, não excluir nada adicional
      if (paymentMethod === 'credit_card') {
        console.log('💳 Checkout específico para cartão');
      }
      
      const preferencePayload = {
        items: [{
          title: body.descricao,
          quantity: 1,
          unit_price: body.valor,
          currency_id: 'BRL',
        }],
        payer: {
          email: clienteEmail,
        },
        external_reference: cobrancaId,
        payment_methods: {
          excluded_payment_types: excludedTypes,
          installments: maxParcelas,
        },
        back_urls: {
          success: `https://gallery.lunarihub.com/payment/success?ref=${cobrancaId}`,
          failure: `https://gallery.lunarihub.com/payment/failure?ref=${cobrancaId}`,
          pending: `https://gallery.lunarihub.com/payment/pending?ref=${cobrancaId}`,
        },
        auto_return: 'approved',
      };

      console.log('Criando preferência de checkout com exclusões:', JSON.stringify(excludedTypes));

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
          JSON.stringify({ success: false, error: 'Erro ao criar checkout', details: errorText }),
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
        .eq('id', cobrancaId);

      if (updateError) {
        console.error('Erro ao atualizar cobrança:', updateError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          preference_id: preferenceData.id,
          payment_method: paymentMethod || 'checkout',
          // Campos padronizados (camelCase) - confirm-selection espera estes nomes
          checkoutUrl: preferenceData.init_point,
          paymentLink: preferenceData.init_point, // Alias para compatibilidade
          cobrancaId: cobrancaId,
          cobranca: { id: cobrancaId }, // Alias para compatibilidade
          provedor: 'mercadopago',
          // Campos legados (snake_case) para compatibilidade retroativa
          checkout_url: preferenceData.init_point,
          sandbox_url: preferenceData.sandbox_init_point,
          cobranca_id: cobrancaId,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Erro ao criar link de pagamento:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno ao processar pagamento' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
