import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { cobrancaId, receiptUrl, paidAt } = await req.json();

    if (!cobrancaId) {
      return new Response(
        JSON.stringify({ success: false, error: 'cobrancaId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Fetch cobrança
    const { data: cobranca, error: fetchError } = await supabase
      .from('cobrancas')
      .select('*')
      .eq('id', cobrancaId)
      .single();

    if (fetchError || !cobranca) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cobrança não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Idempotent: already paid
    if (cobranca.status === 'pago') {
      console.log(`✅ Cobrança ${cobrancaId} já está paga (idempotente)`);
      return new Response(
        JSON.stringify({ success: true, alreadyPaid: true, message: 'Pagamento já confirmado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dataPagamento = paidAt || new Date().toISOString();

    // 3. Update cobrança to pago (with condition to prevent race)
    const updateData: Record<string, unknown> = {
      status: 'pago',
      data_pagamento: dataPagamento,
    };
    if (receiptUrl) updateData.ip_receipt_url = receiptUrl;

    const { error: updateError } = await supabase
      .from('cobrancas')
      .update(updateData)
      .eq('id', cobrancaId)
      .eq('status', 'pendente'); // Only update if still pending

    if (updateError) {
      console.error('❌ Erro ao atualizar cobrança:', updateError);
      // Check if it was already paid by webhook in the meantime
      const { data: recheck } = await supabase
        .from('cobrancas')
        .select('status')
        .eq('id', cobrancaId)
        .single();
      
      if (recheck?.status === 'pago') {
        return new Response(
          JSON.stringify({ success: true, alreadyPaid: true, message: 'Pagamento confirmado por webhook' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao atualizar cobrança' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`💳 Cobrança ${cobrancaId} marcada como paga manualmente`);

    // 4. Update gallery - increment extras and finalize
    if (cobranca.galeria_id) {
      const { data: galeria } = await supabase
        .from('galerias')
        .select('id, total_fotos_extras_vendidas, valor_total_vendido')
        .eq('id', cobranca.galeria_id)
        .single();

      if (galeria) {
        const extrasAtuais = galeria.total_fotos_extras_vendidas || 0;
        const extrasNovas = cobranca.qtd_fotos || 0;
        const valorAtual = Number(galeria.valor_total_vendido) || 0;
        const valorCobranca = Number(cobranca.valor) || 0;

        await supabase
          .from('galerias')
          .update({
            total_fotos_extras_vendidas: extrasAtuais + extrasNovas,
            valor_total_vendido: valorAtual + valorCobranca,
            status_pagamento: 'pago',
            status_selecao: 'selecao_completa',
            finalized_at: dataPagamento,
          })
          .eq('id', cobranca.galeria_id);

        console.log(`✅ Galeria ${cobranca.galeria_id} finalizada: extras ${extrasAtuais}+${extrasNovas}, valor ${valorAtual}+${valorCobranca}`);
      }
    }

    // 5. Update session status if linked
    if (cobranca.session_id) {
      await supabase
        .from('clientes_sessoes')
        .update({ 
          status_galeria: 'selecao_completa', 
          status_pagamento_fotos_extra: 'pago',
          updated_at: new Date().toISOString() 
        })
        .eq('session_id', cobranca.session_id);
      
      console.log(`✅ Sessão ${cobranca.session_id} atualizada`);
    }

    // Note: The trigger ensure_transaction_on_cobranca_paid will auto-create
    // the transaction in clientes_transacoes when cobrancas.status changes to 'pago'

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated: true,
        message: 'Pagamento confirmado manualmente',
        cobrancaId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
