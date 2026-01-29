import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');

    if (!mpAccessToken) {
      return new Response(
        JSON.stringify({ error: 'Configuração de pagamento incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verificar usuário
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    // Parse body
    const { purchase_id } = await req.json();

    if (!purchase_id) {
      return new Response(
        JSON.stringify({ error: 'purchase_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar compra do usuário
    const { data: purchase, error: purchaseError } = await supabaseAuth
      .from('credit_purchases')
      .select('*')
      .eq('id', purchase_id)
      .eq('user_id', userId)
      .single();

    if (purchaseError || !purchase) {
      return new Response(
        JSON.stringify({ error: 'Compra não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se já aprovado, retornar status atual
    if (purchase.status === 'approved') {
      return new Response(
        JSON.stringify({
          success: true,
          status: 'approved',
          credits: purchase.credits_amount,
          paid_at: purchase.paid_at,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se não tem mp_payment_id, pagamento ainda não foi criado no MP
    if (!purchase.mp_payment_id) {
      return new Response(
        JSON.stringify({
          success: true,
          status: 'pending',
          message: 'Aguardando pagamento',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Consultar status no Mercado Pago
    console.log('Verificando pagamento no MP:', purchase.mp_payment_id);

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${purchase.mp_payment_id}`, {
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
      },
    });

    if (!mpResponse.ok) {
      console.error('Erro ao consultar MP:', await mpResponse.text());
      return new Response(
        JSON.stringify({
          success: true,
          status: purchase.status,
          mp_status: purchase.mp_status,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mpPayment = await mpResponse.json();

    console.log('Status MP:', {
      id: mpPayment.id,
      status: mpPayment.status,
      current_db_status: purchase.status,
    });

    // Se status mudou para aprovado e ainda não processamos
    if (mpPayment.status === 'approved' && purchase.status !== 'approved') {
      console.log('Pagamento aprovado, processando créditos...');

      // Usar service role para atualizar
      const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

      // Adicionar créditos
      const { data: ledgerId, error: creditError } = await supabaseService.rpc('purchase_credits', {
        _user_id: userId,
        _amount: purchase.credits_amount,
        _purchase_id: purchase.id,
        _description: `Compra de ${purchase.credits_amount.toLocaleString('pt-BR')} créditos via Mercado Pago`,
      });

      if (creditError) {
        console.error('Erro ao adicionar créditos:', creditError);
        // Pode ser que já foi processado pelo webhook
        if (!creditError.message?.includes('já processada')) {
          return new Response(
            JSON.stringify({ error: 'Erro ao processar créditos' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: 'approved',
          credits: purchase.credits_amount,
          paid_at: mpPayment.date_approved,
          ledger_id: ledgerId,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualizar mp_status se mudou
    if (mpPayment.status !== purchase.mp_status) {
      const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
      await supabaseService
        .from('credit_purchases')
        .update({ mp_status: mpPayment.status })
        .eq('id', purchase.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: purchase.status,
        mp_status: mpPayment.status,
        mp_status_detail: mpPayment.status_detail,
      }),
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
