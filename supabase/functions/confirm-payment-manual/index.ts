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

    // ── AUTH CHECK: Extract and verify the photographer's JWT ──
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Autenticação obrigatória' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a client with the user's JWT to verify identity
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      console.error('❌ Auth error:', authError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido ou expirado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authenticatedUserId = user.id;
    console.log(`🔐 Authenticated user: ${authenticatedUserId}`);

    // Service role client for privileged operations
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

    // ── OWNERSHIP CHECK: Only the photographer who owns the cobrança can confirm ──
    if (cobranca.user_id !== authenticatedUserId) {
      console.error(`❌ Ownership mismatch: cobrança.user_id=${cobranca.user_id}, auth=${authenticatedUserId}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Sem permissão para confirmar esta cobrança' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    console.log(`💳 Cobrança ${cobrancaId} finalizada via RPC por user ${authenticatedUserId}:`, JSON.stringify(rpcResult));

    // AUDIT LOG
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    await supabase.from('audit_log').insert({
      action: 'confirm_payment_manual',
      actor_type: 'user',
      actor_id: authenticatedUserId,
      ip_address: clientIp,
      resource_type: 'payment',
      resource_id: cobrancaId,
      gallery_id: cobranca.galeria_id || null,
      user_agent: req.headers.get('user-agent') || null,
      metadata: { valor: cobranca.valor, provedor: cobranca.provedor },
    }).then(({ error }) => { if (error) console.warn('Audit log error:', error.message); });

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
