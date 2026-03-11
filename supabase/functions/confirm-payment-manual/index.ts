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

    // Save receipt URL if provided (before RPC)
    if (receiptUrl) {
      await supabase
        .from('cobrancas')
        .update({ ip_receipt_url: receiptUrl })
        .eq('id', cobrancaId);
    }

    // Call centralized RPC for atomic payment finalization
    const { data: rpcResult, error: rpcError } = await supabase.rpc('finalize_gallery_payment', {
      p_cobranca_id: cobrancaId,
      p_receipt_url: receiptUrl || null,
      p_paid_at: paidAt || new Date().toISOString(),
    });

    if (rpcError) {
      console.error('❌ RPC finalize_gallery_payment error:', rpcError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao finalizar pagamento' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = rpcResult as Record<string, unknown>;
    
    if (result?.already_paid) {
      console.log(`✅ Cobrança ${cobrancaId} já está paga (idempotente)`);
      return new Response(
        JSON.stringify({ success: true, alreadyPaid: true, message: 'Pagamento já confirmado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`💳 Cobrança ${cobrancaId} finalizada via RPC:`, JSON.stringify(rpcResult));

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
