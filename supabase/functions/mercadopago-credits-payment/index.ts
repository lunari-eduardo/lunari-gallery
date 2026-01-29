import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PaymentRequest {
  package_id: string;
  payment_method: 'pix' | 'credit_card';
  card_token?: string;
  payer_email: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');

    if (!mpAccessToken) {
      console.error('MERCADOPAGO_ACCESS_TOKEN não configurado');
      return new Response(
        JSON.stringify({ error: 'Configuração de pagamento incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Obter usuário autenticado
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    const userEmail = user.email || '';

    // Parse body
    const body: PaymentRequest = await req.json();
    const { package_id, payment_method, card_token, payer_email } = body;

    if (!package_id || !payment_method) {
      return new Response(
        JSON.stringify({ error: 'package_id e payment_method são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (payment_method === 'credit_card' && !card_token) {
      return new Response(
        JSON.stringify({ error: 'card_token é obrigatório para cartão de crédito' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar pacote
    const { data: packageData, error: packageError } = await supabase
      .from('gallery_credit_packages')
      .select('*')
      .eq('id', package_id)
      .eq('active', true)
      .single();

    if (packageError || !packageData) {
      console.error('Pacote não encontrado:', packageError);
      return new Response(
        JSON.stringify({ error: 'Pacote não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar registro de compra
    const { data: purchase, error: purchaseError } = await supabase
      .from('credit_purchases')
      .insert({
        user_id: userId,
        package_id: package_id,
        credits_amount: packageData.credits,
        price_cents: packageData.price_cents,
        payment_method: payment_method,
        status: 'pending',
      })
      .select()
      .single();

    if (purchaseError || !purchase) {
      console.error('Erro ao criar compra:', purchaseError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar registro de compra' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Preparar payload para Mercado Pago
    const mpPayload: Record<string, unknown> = {
      transaction_amount: packageData.price_cents / 100, // MP espera em reais
      description: `${packageData.credits.toLocaleString('pt-BR')} créditos de foto - ${packageData.name}`,
      external_reference: purchase.id, // Usar ID da compra como referência
      payer: {
        email: payer_email || userEmail,
      },
    };

    if (payment_method === 'pix') {
      mpPayload.payment_method_id = 'pix';
    } else if (payment_method === 'credit_card') {
      mpPayload.token = card_token;
      mpPayload.installments = 1; // À vista
    }

    console.log('Criando pagamento no Mercado Pago:', {
      purchase_id: purchase.id,
      amount: mpPayload.transaction_amount,
      method: payment_method,
    });

    // Criar pagamento no Mercado Pago
    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': purchase.id, // Idempotência
      },
      body: JSON.stringify(mpPayload),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('Erro Mercado Pago:', mpData);
      
      // Atualizar compra como falha
      await supabase
        .from('credit_purchases')
        .update({ 
          status: 'rejected',
          metadata: { mp_error: mpData }
        })
        .eq('id', purchase.id);

      return new Response(
        JSON.stringify({ 
          error: 'Erro ao processar pagamento',
          details: mpData.message || mpData.cause?.[0]?.description || 'Erro desconhecido'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Pagamento criado com sucesso:', {
      mp_payment_id: mpData.id,
      status: mpData.status,
    });

    // Preparar dados para atualização
    const updateData: Record<string, unknown> = {
      mp_payment_id: String(mpData.id),
      mp_status: mpData.status,
      metadata: {
        mp_response: {
          id: mpData.id,
          status: mpData.status,
          status_detail: mpData.status_detail,
          date_created: mpData.date_created,
        }
      }
    };

    // Para PIX, salvar dados do QR Code
    if (payment_method === 'pix' && mpData.point_of_interaction?.transaction_data) {
      const txData = mpData.point_of_interaction.transaction_data;
      updateData.pix_qr_code = txData.qr_code;
      updateData.pix_qr_code_base64 = txData.qr_code_base64;
      updateData.pix_copia_cola = txData.qr_code;
      
      // PIX expira em 24h por padrão
      if (mpData.date_of_expiration) {
        updateData.pix_expiration = mpData.date_of_expiration;
      }
    }

    // Se cartão aprovado imediatamente, processar créditos
    if (payment_method === 'credit_card' && mpData.status === 'approved') {
      updateData.status = 'approved';
      updateData.paid_at = new Date().toISOString();

      // Chamar RPC para adicionar créditos
      const { data: ledgerId, error: creditError } = await supabase.rpc('purchase_credits', {
        _user_id: userId,
        _amount: packageData.credits,
        _purchase_id: purchase.id,
        _description: `Compra de ${packageData.credits.toLocaleString('pt-BR')} créditos - ${packageData.name}`,
      });

      if (creditError) {
        console.error('Erro ao adicionar créditos:', creditError);
        // Não falhar a resposta, pois o pagamento foi aprovado
        // O webhook pode tentar novamente
      } else {
        updateData.ledger_id = ledgerId;
      }
    }

    // Atualizar compra com dados do MP
    await supabase
      .from('credit_purchases')
      .update(updateData)
      .eq('id', purchase.id);

    // Preparar resposta
    const response: Record<string, unknown> = {
      success: true,
      purchase_id: purchase.id,
      mp_payment_id: mpData.id,
      status: mpData.status,
      status_detail: mpData.status_detail,
      credits: packageData.credits,
      amount: packageData.price_cents / 100,
    };

    if (payment_method === 'pix' && mpData.point_of_interaction?.transaction_data) {
      const txData = mpData.point_of_interaction.transaction_data;
      response.pix = {
        qr_code: txData.qr_code,
        qr_code_base64: txData.qr_code_base64,
        expiration: mpData.date_of_expiration,
      };
    }

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro inesperado:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
