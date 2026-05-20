/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  CONTRATO: REGISTRAR RECEBIMENTO MANUAL                     ║
 * ║                                                              ║
 * ║  Aceita recebimento manual (dinheiro, pix externo, etc.)     ║
 * ║  OU confirma cobrança existente como paga.                   ║
 * ║  Cria cobrança manual se cobrancaId não fornecido.           ║
 * ║                                                              ║
 * ║  REGRAS:                                                     ║
 * ║  1. verify_jwt = false no config.toml                        ║
 * ║  2. Validação JWT feita IN-CODE via getUser()                ║
 * ║  3. Ownership check obrigatório via user_id                  ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};


async function notifyPaymentConfirmed(supabaseUrl: string, serviceKey: string, paymentId: string) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: 'payment_confirmed', paymentId }),
    });
    if (!response.ok) console.warn('⚠️ payment email notification failed:', response.status, await response.text());
  } catch (error) {
    console.warn('⚠️ payment email notification exception:', error);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🚀 confirm-payment-manual started');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // ── IN-CODE JWT VALIDATION (verify_jwt = false) ──
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ No authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Autenticação obrigatória' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    console.log('🔑 Validating JWT via getUser...');
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !userData?.user) {
      console.error('❌ JWT validation failed:', userError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido ou expirado. Recarregue a página.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authenticatedUserId = userData.user.id;
    console.log(`🔐 Auth validated: ${authenticatedUserId}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { cobrancaId, galleryId, sessionId, metodoManual, valorManual, observacao, receiptUrl, paidAt } = body;
    console.log('📦 Body received:', JSON.stringify({ cobrancaId, galleryId, sessionId, metodoManual, valorManual }));

    let targetCobrancaId = cobrancaId;
    let cancelledPendingIds: string[] = [];

    // ── PRE-CHECK: se cobrancaId aponta para cobrança JÁ QUITADA/CANCELADA, REJEITAR.
    // Cenário: galeria reativada onde a "última cobrança" da galeria é uma já paga
    // de rodada anterior. Sobrescrever valor/status corromperia o histórico.
    // Frontend deve enviar cobrancaId=null para criarmos cobrança manual nova da rodada atual.
    if (targetCobrancaId) {
      const { data: existingCheck } = await supabase
        .from('cobrancas')
        .select('id, status, provedor')
        .eq('id', targetCobrancaId)
        .maybeSingle();
      if (existingCheck && ['pago', 'pago_manual', 'cancelado'].includes(existingCheck.status)) {
        console.warn(`⚠️ Cobrança ${targetCobrancaId} status=${existingCheck.status} — não pode ser reutilizada. Criando nova manual.`);
        targetCobrancaId = null;
      } else if (
        existingCheck &&
        metodoManual &&
        existingCheck.provedor &&
        existingCheck.provedor !== 'manual' &&
        (galleryId || sessionId)
      ) {
        // Recebimento manual em cima de cobrança digital pendente:
        // descartamos o cobrancaId p/ criar nova cobrança 'manual' e cancelar a digital.
        // Mantém histórico fiel ao método escolhido pelo fotógrafo.
        console.log(`🔁 Manual sobre digital pendente (${existingCheck.provedor}) — criando nova cobrança manual e cancelando a digital`);
        targetCobrancaId = null;
      }
    }

    // If no cobrancaId, create a manual cobrança
    if (!targetCobrancaId) {
      if (!galleryId && !sessionId) {
        console.error('❌ Missing cobrancaId and galleryId/sessionId');
        return new Response(
          JSON.stringify({ success: false, error: 'cobrancaId ou galleryId/sessionId é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Resolve gallery info
      let resolvedGalleryId = galleryId;
      let resolvedSessionId = sessionId;
      let resolvedClienteId: string | null = null;
      let resolvedValor = valorManual || 0;

      if (galleryId) {
        console.log(`📋 Resolving gallery info for: ${galleryId}`);
        const { data: gallery } = await supabase
          .from('galerias')
          .select('session_id, cliente_id, valor_extras')
          .eq('id', galleryId)
          .single();
        if (gallery) {
          resolvedSessionId = resolvedSessionId || gallery.session_id;
          resolvedClienteId = gallery.cliente_id;
          if (!valorManual && gallery.valor_extras) resolvedValor = gallery.valor_extras;
        }
      }

      // ── CANCELAR cobranças digitais pendentes da mesma galeria
      // (escolha do usuário: substituir link digital por recebimento manual).
      if (resolvedGalleryId) {
        const { data: pendingDigital } = await supabase
          .from('cobrancas')
          .select('id, provedor')
          .eq('galeria_id', resolvedGalleryId)
          .eq('status', 'pendente')
          .neq('provedor', 'manual');
        if (pendingDigital && pendingDigital.length > 0) {
          for (const p of pendingDigital) {
            const { error: cancelErr } = await supabase
              .from('cobrancas')
              .update({
                status: 'cancelado',
                obs_manual: `Cancelada — substituída por recebimento manual em ${new Date().toISOString()}`,
                updated_at: new Date().toISOString(),
              })
              .eq('id', p.id);
            if (!cancelErr) {
              cancelledPendingIds.push(p.id);
              console.log(`🚫 Cobrança digital pendente cancelada: ${p.id} (${p.provedor})`);
            } else {
              console.warn(`⚠️ Falha ao cancelar cobrança ${p.id}:`, cancelErr.message);
            }
          }
        }
      }

      // Dedup contra duplo-click: cobrança manual pendente idêntica nos últimos 60s
      if (resolvedGalleryId) {
        const { data: existingDup } = await supabase
          .from('cobrancas')
          .select('id')
          .eq('galeria_id', resolvedGalleryId)
          .eq('valor', resolvedValor)
          .eq('provedor', 'manual')
          .eq('metodo_manual', metodoManual || 'dinheiro')
          .eq('status', 'pendente')
          .gte('created_at', new Date(Date.now() - 60 * 1000).toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existingDup) {
          targetCobrancaId = existingDup.id;
          console.log(`♻️ Reusing pending manual cobrança (dedup 60s): ${targetCobrancaId}`);
        }
      }

      if (!targetCobrancaId) {
        console.log(`📝 Creating manual cobrança: gallery=${resolvedGalleryId}, session=${resolvedSessionId}, valor=${resolvedValor}`);
        const { data: newCobranca, error: insertError } = await supabase
          .from('cobrancas')
          .insert({
            user_id: authenticatedUserId,
            galeria_id: resolvedGalleryId || null,
            session_id: resolvedSessionId || null,
            cliente_id: resolvedClienteId || null,
            valor: resolvedValor,
            tipo_cobranca: 'foto_extra',
            provedor: 'manual',
            status: 'pendente',
            metodo_manual: metodoManual || 'dinheiro',
            obs_manual: observacao || null,
          })
          .select('id')
          .single();

        if (insertError || !newCobranca) {
          console.error('❌ Error creating manual cobrança:', insertError?.message, insertError?.details);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao criar registro de recebimento: ' + (insertError?.message || 'unknown') }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        targetCobrancaId = newCobranca.id;
        console.log(`✅ Created manual cobrança: ${targetCobrancaId}`);
      }
    }

    // Fetch cobrança to verify ownership
    console.log(`📋 Fetching cobrança: ${targetCobrancaId}`);
    const { data: cobranca, error: fetchError } = await supabase
      .from('cobrancas')
      .select('*')
      .eq('id', targetCobrancaId)
      .single();

    if (fetchError || !cobranca) {
      console.error('❌ Cobrança not found:', fetchError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Cobrança não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── OWNERSHIP CHECK ──
    if (cobranca.user_id !== authenticatedUserId) {
      console.error(`❌ Ownership mismatch: cobrança.user_id=${cobranca.user_id}, auth=${authenticatedUserId}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Sem permissão para confirmar esta cobrança' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── ATUALIZAR valor APENAS se cobrança ainda está pendente.
    // Para cobranças já pagas, NUNCA sobrescrever valor (corrompe histórico e contadores).
    if (valorManual && valorManual !== Number(cobranca.valor) && cobranca.status === 'pendente') {
      console.log(`💰 Updating valor (pendente): ${cobranca.valor} → ${valorManual}`);
      await supabase
        .from('cobrancas')
        .update({ valor: valorManual })
        .eq('id', targetCobrancaId);
    } else if (valorManual && valorManual !== Number(cobranca.valor)) {
      console.warn(`🛡️ Bloqueado: tentativa de alterar valor de cobrança status=${cobranca.status} (${cobranca.valor} → ${valorManual})`);
    }

    // Call RPC for atomic payment finalization
    console.log(`🔄 Calling RPC finalize_gallery_payment for cobrança ${targetCobrancaId}`);
    const { data: rpcResult, error: rpcError } = await supabase.rpc('finalize_gallery_payment', {
      p_cobranca_id: targetCobrancaId,
      p_receipt_url: receiptUrl || null,
      p_paid_at: paidAt || new Date().toISOString(),
      p_manual_method: metodoManual || null,
      p_manual_obs: observacao || null,
    });

    if (rpcError) {
      console.error('❌ RPC finalize_gallery_payment error:', rpcError.message, rpcError.details, rpcError.hint);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao finalizar pagamento: ' + rpcError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ RPC result:`, JSON.stringify(rpcResult));
    const result = rpcResult as Record<string, unknown>;

    if (result?.already_paid) {
      console.log(`✅ Cobrança ${targetCobrancaId} já está paga (idempotente), gallery_synced=${result?.gallery_synced}`);
      return new Response(
        JSON.stringify({ success: true, alreadyPaid: true, gallerySynced: result?.gallery_synced, message: 'Pagamento já confirmado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await notifyPaymentConfirmed(supabaseUrl, supabaseServiceKey, targetCobrancaId);

    console.log(`💳 Cobrança ${targetCobrancaId} finalizada por user ${authenticatedUserId}`);

    // AUDIT LOG
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    await supabase.from('audit_log').insert({
      action: 'confirm_payment_manual',
      actor_type: 'user',
      actor_id: authenticatedUserId,
      ip_address: clientIp,
      resource_type: 'payment',
      resource_id: targetCobrancaId,
      gallery_id: cobranca.galeria_id || null,
      user_agent: req.headers.get('user-agent') || null,
      metadata: {
        valor: valorManual || cobranca.valor,
        provedor: metodoManual || 'manual',
        observacao,
        cancelled_pending_ids: cancelledPendingIds,
      },
    }).then(({ error }) => { if (error) console.warn('Audit log error:', error.message); });

    return new Response(
      JSON.stringify({
        success: true,
        updated: true,
        message: 'Recebimento registrado com sucesso',
        cobrancaId: targetCobrancaId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro fatal:', error?.message, error?.stack);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || 'Erro interno do servidor', stack: error?.stack?.split('\n').slice(0, 3) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
