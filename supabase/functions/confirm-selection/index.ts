import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';
import { logAuditEvent, getCorrelationId } from '../_shared/audit.ts';
import { errorResponse, successResponse, corsHeaders } from '../_shared/responses.ts';
import { resolveGalleryByToken } from '../_shared/database.ts';
import { syncSessionOnFinalize } from '../_shared/session-sync.ts';

// Handshake com gallery-create-payment — deve bater com GCP_VERSION lá.
const EXPECTED_GCP_VERSION = 'v2.2.1';


// Rate limiter — in-memory per isolate
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // confirm-selection is heavy, low limit
const RATE_WINDOW = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

interface RequestBody {
  galleryToken: string;
  selectedCount: number;
  extraCount?: number;
  valorUnitario?: number;
  valorTotal?: number;
  requestPayment?: boolean;
  visitorId?: string;  // Required for public galleries
}

import { RegrasCongeladas, Gallery } from '../_shared/types.ts';
import { calcularPrecoProgressivoComCredito } from '../_shared/pricing.ts';


// confirm-selection v2.2.1-final (deploy 2026-08-03) (2026-08-03)
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const correlationId = getCorrelationId(req);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Definir correlation_id na sessão do Postgres para as triggers usarem
    await supabase.rpc('set_config', { name: 'app.correlation_id', value: correlationId });

    // Rate limit check
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(clientIp)) {
      return errorResponse('Muitas requisições. Tente novamente em instantes.', 429);
    }


    const body: RequestBody = await req.json();
    const { extraCount, requestPayment, galleryToken, visitorId } = body;

    // Log início do processo
    await logAuditEvent({
      correlationId,
      eventType: 'CONFIRM_SELECTION_START',
      source: 'edge_function',
      sourceName: 'confirm-selection',
      payload: { galleryToken, visitorId, extraCount, requestPayment }
    });

    // galleryToken is now REQUIRED — UUID access removed
    if (!galleryToken) {
      return errorResponse('galleryToken é obrigatório', 400);
    }


    const { id: galleryId, error: tokenError } = await resolveGalleryByToken(supabase, galleryToken);

    if (tokenError || !galleryId) {
      console.error('Gallery not found or token error:', tokenError);
      return errorResponse('Galeria não encontrada', 404);
    }

    // 🔒 R1 (gallery-rules): guard determinístico ANTES do lock.
    // Se galeria (ou visitante) já tem finalized_at, jamais aceitar nova
    // finalização — retorna 409 com código ALREADY_FINALIZED para o
    // cliente forçar refetch e cair na tela de pagamento pendente.
    {
      const { data: gRow } = await supabase
        .from('galerias')
        .select('finalized_at, status_selecao')
        .eq('id', galleryId)
        .maybeSingle();
      let vFinalized = false;
      if (visitorId) {
        const { data: vRow } = await supabase
          .from('galeria_visitantes')
          .select('finalized_at')
          .eq('id', visitorId)
          .maybeSingle();
        vFinalized = !!(vRow as any)?.finalized_at;
      }
      if ((gRow as any)?.finalized_at || vFinalized) {
        console.log(`🔒 [confirm-selection] ALREADY_FINALIZED gallery=${galleryId} visitor=${visitorId || 'n/a'}`);
        return errorResponse('Seleção já finalizada', 409, 'ALREADY_FINALIZED');
      }
    }



    // ── SERVER-SIDE COUNT: Never trust frontend selectedCount ──
    // For public galleries with visitor: count from visitante_selecoes
    // For private galleries: count from galeria_fotos
    let selectedCount = 0;

    if (visitorId) {
      const { count: visitorCount, error: vCountError } = await supabase
        .from('visitante_selecoes')
        .select('id', { count: 'exact', head: true })
        .eq('visitante_id', visitorId)
        .eq('is_selected', true);
      if (vCountError) {
        console.error('❌ Error counting visitor selections:', vCountError);
        return errorResponse('Erro ao contar fotos selecionadas', 500);
      }

      selectedCount = visitorCount || 0;
    } else {
      const { count: serverSelectedCount, error: countError } = await supabase
        .from('galeria_fotos')
        .select('id', { count: 'exact', head: true })
        .eq('galeria_id', galleryId)
        .eq('is_selected', true);
      if (countError) {
        console.error('❌ Error counting selected photos:', countError);
        return errorResponse('Erro ao contar fotos selecionadas', 500);
      }

      selectedCount = serverSelectedCount || 0;
    }
    console.log(`🔒 Server-side selected count: ${selectedCount} (frontend sent: ${body.selectedCount}, visitorId: ${visitorId || 'none'})`);

    // Block empty selections
    if (selectedCount === 0) {
      await supabase.from('galerias').update({
        status_selecao: 'selecao_iniciada',
        updated_at: new Date().toISOString(),
      }).eq('id', galleryId);
      return errorResponse('Nenhuma foto selecionada', 400);

    }


    // 1. Acquire atomic lock — visitor-level for public galleries, gallery-level for private
    let lockResult: any;
    let lockError: any;

    if (visitorId) {
      const res = await supabase.rpc('try_lock_visitor_selection', { p_visitor_id: visitorId });
      lockResult = res.data;
      lockError = res.error;
    } else {
      const res = await supabase.rpc('try_lock_gallery_selection', { p_gallery_id: galleryId });
      lockResult = res.data;
      lockError = res.error;
    }

    if (lockError) {
      console.error('Lock RPC error:', JSON.stringify({ message: lockError.message, code: lockError.code, details: lockError.details, hint: lockError.hint }));
      return errorResponse('Erro ao processar seleção', 500, lockError.code || 'LOCK_ERROR');
    }


    if (!lockResult?.locked) {
      const reason = lockResult?.reason || 'unknown';
      console.log(`🔒 Lock denied (visitor=${visitorId || 'none'}, gallery=${galleryId}): ${reason}`);
      return errorResponse('A seleção já está sendo processada ou foi confirmada', 409, 'ALREADY_PROCESSING');
    }


    // ── ROLLBACK HELPER: Reset status on any failure after lock ──
    // R6 (gallery-rules): NUNCA reseta se finalized_at já existir.
    const rollbackGalleryStatus = async () => {
      try {
        if (visitorId) {
          const { data: v } = await supabase
            .from('galeria_visitantes')
            .select('finalized_at')
            .eq('id', visitorId)
            .maybeSingle();
          if ((v as any)?.finalized_at) {
            console.log(`🛡️ Rollback ignorado: visitor ${visitorId} já finalizado.`);
            return;
          }
          await supabase.from('galeria_visitantes').update({
            status_selecao: 'selecao_iniciada',
            updated_at: new Date().toISOString(),
          }).eq('id', visitorId);
          console.log(`🔓 Rollback: Visitor ${visitorId} status_selecao reset to selecao_iniciada`);
        } else {
          const { data: g } = await supabase
            .from('galerias')
            .select('finalized_at')
            .eq('id', galleryId)
            .maybeSingle();
          if ((g as any)?.finalized_at) {
            console.log(`🛡️ Rollback ignorado: galeria ${galleryId} já finalizada.`);
            return;
          }
          await supabase.from('galerias').update({
            status_selecao: 'selecao_iniciada',
            updated_at: new Date().toISOString(),
          }).eq('id', galleryId);
          console.log(`🔓 Rollback: Gallery ${galleryId} status_selecao reset to selecao_iniciada`);
        }
      } catch (rollbackErr) {
        console.error(`❌ Rollback failed:`, rollbackErr);
      }
    };

    // Gallery data returned from the lock RPC
    const gallery = lockResult.gallery as Gallery & {
      session_id: string | null;
      nome_sessao: string | null;
      venda_tipo_cobranca?: string;
    };


    // 3. Calculate progressive pricing using CREDIT SYSTEM
    // Formula: valor_a_cobrar = (total_extras × valor_faixa) - valor_já_pago
    let valorUnitario = 0;
    let valorTotal = 0;
    
    // Use explicit column from contract, fallback to JSON
    const saleSettingsJson = (gallery.configuracoes as any)?.saleSettings || {};
    const chargeType = gallery.venda_tipo_cobranca || saleSettingsJson.chargeType || 'only_extras';

    
    // Calculate extras needed based on chargeType:
    // - 'all_selected': charge for ALL selected photos (for public/paid galleries)
    // - 'only_extras': charge only for photos beyond the included limit (default)
    const extrasNecessarias = chargeType === 'all_selected'
      ? (selectedCount || 0)  // ALL selected photos are chargeable
      : Math.max(0, (selectedCount || 0) - (gallery.fotos_incluidas || 0));  // Only extras
    
    console.log(`📊 ChargeType: ${chargeType}, selectedCount=${selectedCount}, fotosIncluidas=${gallery.fotos_incluidas}, extrasNecessarias=${extrasNecessarias}`);
    
    // Get previously paid extras from gallery record
    let extrasPagasTotal = gallery.total_fotos_extras_vendidas || 0;
    let valorJaPago = gallery.valor_total_vendido || 0;

    // 🛡️ AUTO-HEAL preventivo (provedor-agnóstico)
    // Se há cobranças pagas para esta galeria mas os contadores estão zerados,
    // significa que algum webhook (Asaas + parcelas, MP, InfinitePay) deixou
    // a galeria fora de sincronia. Chamamos finalize_gallery_payment para cada
    // cobrança pendente de contabilização — a RPC é idempotente via
    // `extras_contabilizados`, então é seguro chamar múltiplas vezes.
    if (extrasPagasTotal === 0) {
      // Fase 4: HEAD count antes do SELECT completo — só carrega payload de cobranças
      // quando realmente há divergência. 99% das primeiras confirmações não têm.
      const { count: paidCount } = await supabase
        .from('cobrancas')
        .select('id', { count: 'exact', head: true })
        .eq('galeria_id', galleryId)
        .in('status', ['pago', 'pago_manual']);

      if ((paidCount ?? 0) > 0) {
        const { data: paidCharges } = await supabase
          .from('cobrancas')
          .select('id, valor, qtd_fotos, extras_contabilizados, status')
          .eq('galeria_id', galleryId)
          .in('status', ['pago', 'pago_manual']);

        const needsHeal = (paidCharges || []).filter((c) => c.extras_contabilizados !== true);
        if (needsHeal.length > 0) {
          console.warn(`⚠️ DIVERGÊNCIA: galeria ${galleryId} tem ${needsHeal.length} cobrança(s) paga(s) não contabilizada(s). Auto-heal disparado.`);
          for (const c of needsHeal) {
            try {
              await supabase.rpc('finalize_gallery_payment', {
                p_cobranca_id: c.id,
                p_receipt_url: null,
                p_paid_at: new Date().toISOString(),
                p_manual_method: null,
                p_manual_obs: null,
              });
            } catch (healErr) {
              console.error(`❌ Auto-heal falhou para cobrança ${c.id}:`, healErr);
            }
          }
          const { data: refreshed } = await supabase
            .from('galerias')
            .select('total_fotos_extras_vendidas, valor_total_vendido')
            .eq('id', galleryId)
            .single();
          if (refreshed) {
            extrasPagasTotal = refreshed.total_fotos_extras_vendidas || 0;
            valorJaPago = refreshed.valor_total_vendido || 0;
            console.log(`✅ Auto-heal concluído: extras_pagas=${extrasPagasTotal}, valor_pago=R$${valorJaPago}`);
          }
        }
      }
    }


    // ── SOURCE OF TRUTH FOR PRICE ──
    // R8 (gallery-rules): valor é calculado EXCLUSIVAMENTE pela RPC canônica
    // `calculate_gallery_extra_payment`. Nem front nem edge functions podem recalcular.
    // Isso elimina divergências vs `tg_protect_no_overcharge` (que usa a mesma RPC).
    let extrasACobrar = Math.max(0, extrasNecessarias - extrasPagasTotal);
    const extrasCount = extraCount ?? extrasNecessarias;
    let canonRulesSource: string | null = null;


    // 🔧 SYNC ANTES DA RPC CANÔNICA
    // A RPC calculate_gallery_extra_payment lê galerias.fotos_selecionadas.
    // Essa coluna só era atualizada no commit final, então em cenários de
    // primeira confirmação/reabertura a RPC recebia valor obsoleto (0/qtd antiga)
    // e retornava extras_a_cobrar=0 → galeria era finalizada sem cobrar.
    // Sincronizamos aqui, antes de qualquer decisão de cobrança.
    {
      const { error: syncErr } = await supabase
        .from('galerias')
        .update({ fotos_selecionadas: selectedCount, updated_at: new Date().toISOString() })
        .eq('id', galleryId);
      if (syncErr) {
        console.error('❌ Falha ao sincronizar fotos_selecionadas antes da RPC:', syncErr);
        await rollbackGalleryStatus();
        return errorResponse('Erro ao sincronizar seleção', 500, 'SELECTION_SYNC_ERROR');
      }
    }



    try {
      const { data: canon, error: canonErr } = await supabase.rpc('calculate_gallery_extra_payment', {
        p_gallery_id: galleryId,
        // Bypass do pre_selecao_gate: estamos no momento canônico da transição
        // selecao_iniciada -> selecao_completa; sem bypass a RPC retorna 0.
        p_bypass_pre_selecao_gate: true,
      });


      if (canonErr) throw canonErr;
      if (!canon || (canon as any).success !== true) {
        throw new Error(`RPC retornou success=false: ${JSON.stringify(canon)}`);
      }

      const c = canon as Record<string, any>;
      canonRulesSource = c.rules_source ?? null;
      valorUnitario = Number(c.valor_unitario) || 0;
      valorTotal = Number(c.valor_a_cobrar) || 0;
      extrasACobrar = Number(c.extras_a_cobrar) || 0;
      extrasPagasTotal = Number(c.extras_pagas) || extrasPagasTotal;
      valorJaPago = Number(c.valor_pago) || valorJaPago;




      console.log(`📊 [RPC canônica] rules_source=${c.rules_source}, extras_necess=${c.extras_necessarias}, extras_pagas=${c.extras_pagas}, extras_a_cobrar=${c.extras_a_cobrar}, valor_unitario=R$${c.valor_unitario}, valor_total_ideal=R$${c.valor_total_ideal}, valor_pago=R$${c.valor_pago}, valor_a_cobrar=R$${c.valor_a_cobrar}`);
    } catch (rpcErr) {
      // Fallback defensivo: se a RPC canônica falhar, cai no cálculo local.
      // Loga como ERRO porque isso NÃO deve acontecer em produção — trigger
      // tg_protect_no_overcharge pode rejeitar se houver divergência.
      console.error('❌ [FALLBACK] calculate_gallery_extra_payment falhou, usando cálculo local:', rpcErr);

      let regrasCongeladasSource: RegrasCongeladas | null = null;
      let fallbackPrice = Number(gallery.valor_foto_extra || 0);

      if (fallbackPrice <= 0) {
        if (gallery.session_id) {
          const { data: sessao } = await supabase
            .from('clientes_sessoes')
            .select('regras_congeladas')
            .eq('session_id', gallery.session_id)
            .single();
          if (sessao?.regras_congeladas) {
            regrasCongeladasSource = sessao.regras_congeladas as RegrasCongeladas;
          }
        }
        if (!regrasCongeladasSource && gallery.regras_congeladas) {
          regrasCongeladasSource = gallery.regras_congeladas as RegrasCongeladas;
        }
        if (regrasCongeladasSource) {
          fallbackPrice = Number((regrasCongeladasSource as any)?.pacote?.valorFotoExtra ?? 0);
        }
      }

      const resultado = calcularPrecoProgressivoComCredito(
        extrasACobrar,
        extrasPagasTotal,
        valorJaPago,
        regrasCongeladasSource,
        fallbackPrice
      );
      valorUnitario = resultado.valorUnitario;
      valorTotal = resultado.valorACobrar;
    }

    console.log(`📊 Extras (final): necessarias=${extrasNecessarias}, pagas=${extrasPagasTotal}, a_cobrar=${extrasACobrar}, valorJaPago=R$${valorJaPago}, valorACobrar=R$${valorTotal}`);

    // 4. Parse sale settings to determine if payment is required
    // CRITICAL: Decision is 100% server-side — frontend's requestPayment is IGNORED
    // Normalization rule (contrato pipeline): COLUNAS > JSON > default.
    // A trigger `tg_sync_gallery_sale_settings_json` mantém JSON alinhado, mas em
    // caso de qualquer divergência residual, a coluna vence sempre.
    const saleSettingsMode = saleSettingsJson.mode;
    const vendaModoColumn = gallery.venda_modo;

    const VALID_SALE_MODES = ['no_sale', 'sale_with_payment', 'sale_without_payment'];
    const isValidVendaModoColumn = vendaModoColumn && VALID_SALE_MODES.includes(vendaModoColumn);
    const isValidVendaModoJson = saleSettingsMode && VALID_SALE_MODES.includes(saleSettingsMode);

    // Column-first precedence
    const saleMode = isValidVendaModoColumn
      ? vendaModoColumn
      : (isValidVendaModoJson ? saleSettingsMode : 'no_sale');

    if (isValidVendaModoColumn && isValidVendaModoJson && saleSettingsMode !== vendaModoColumn) {
      console.warn(`⚠️ SALE_MODE_DIVERGENCE gallery=${galleryId} column=${vendaModoColumn} json=${saleSettingsMode} — column wins`);
      await logAuditEvent({
        correlationId,
        eventType: 'SALE_MODE_DIVERGENCE',
        source: 'edge_function',
        sourceName: 'confirm-selection',
        payload: { galleryId, column: vendaModoColumn, json: saleSettingsMode }
      });
    }

    // Payment method: coluna venda_pagamento_provedor > JSON.paymentMethod
    const configuredPaymentMethod = gallery.venda_pagamento_provedor || saleSettingsJson.paymentMethod;

    // Server-side rule: if mode is sale_with_payment AND there's value to charge, payment is required
    const shouldCreatePayment = saleMode === 'sale_with_payment' && valorTotal > 0 && extrasACobrar > 0;

    console.log(`💰 Payment check: mode=${saleMode} (source: ${isValidVendaModoColumn ? 'column' : isValidVendaModoJson ? 'json' : 'default'}), provider=${configuredPaymentMethod}, valorTotal=${valorTotal}, extrasACobrar=${extrasACobrar}, shouldCreate=${shouldCreatePayment}`);

    // 🛡️ CONTRACT GUARD (server-side): se a galeria opera em sale_with_payment e há
    // seleção acima do incluído (ou all_selected com qualquer foto), mas o cálculo
    // canônico retornou zero E não há histórico pago que justifique — NUNCA finalizar
    // em silêncio. Devolve erro para o cliente retomar; rollback do status.
    {
      const debeCobrar =
        saleMode === 'sale_with_payment' &&
        (chargeType === 'all_selected'
          ? selectedCount > 0
          : selectedCount > (gallery.fotos_incluidas || 0));
      const jaQuitado = extrasPagasTotal >= extrasNecessarias && extrasNecessarias > 0;
      if (debeCobrar && !shouldCreatePayment && !jaQuitado) {
        console.warn('⚠️ [CONTRACT GUARD BYPASS] Cálculo retornou zero em galeria que exigia cobrança. O cliente terá a galeria finalizada gratuitamente. Regras:', {
          galleryId, selectedCount, fotos_incluidas: gallery.fotos_incluidas,
          extrasNecessarias, extrasPagasTotal, valorTotal, chargeType,
          rulesSource: canonRulesSource,
        });
        
        // Em vez de barrar o cliente com erro 500 (o que causa frustração se o preço
        // for intencionalmente zero), permitimos que a galeria seja finalizada como 'sem cobrança'.
      }
    }






    // 5. CRITICAL: If payment is required, create it BEFORE confirming gallery
    let paymentResponse: { checkoutUrl?: string; provedor?: string; cobrancaId?: string } | null = null;
    let statusPagamento = 'sem_vendas'; // Default for no payment

    if (shouldCreatePayment) {
      console.log(`💳 PAYMENT REQUIRED: Creating payment for ${extrasCount} extras, total R$ ${valorTotal}`);
      console.log(`💳 Configured payment method: ${configuredPaymentMethod || 'default'}`);

      // Discover payment provider
      let integracao;

      if (configuredPaymentMethod) {
        const { data } = await supabase
          .from('usuarios_integracoes')
          .select('provedor, dados_extras')
          .eq('user_id', gallery.user_id)
          .eq('provedor', configuredPaymentMethod)
          .eq('status', 'ativo')
          .maybeSingle();
        integracao = data;
      } else {
        const { data } = await supabase
          .from('usuarios_integracoes')
          .select('provedor, dados_extras')
          .eq('user_id', gallery.user_id)
          .eq('is_default', true)
          .eq('status', 'ativo')
          .in('provedor', ['mercadopago', 'infinitepay', 'pix_manual', 'asaas'])
          .maybeSingle();
        integracao = data;

        if (!integracao) {
          const { data: anyActive } = await supabase
            .from('usuarios_integracoes')
            .select('provedor, dados_extras')
            .eq('user_id', gallery.user_id)
            .eq('status', 'ativo')
            .in('provedor', ['mercadopago', 'infinitepay', 'pix_manual', 'asaas'])
            .limit(1)
            .maybeSingle();
          integracao = anyActive;
        }
      }

      // Handle PIX Manual - no checkout link, just mark as awaiting confirmation
      if (integracao?.provedor === 'pix_manual') {
        const pixData = integracao.dados_extras as { chavePix?: string; nomeTitular?: string; tipoChave?: string } | null;
        statusPagamento = 'aguardando_confirmacao';

        // Update gallery with PIX data (will be done after main update)
        paymentResponse = {
          provedor: 'pix_manual',
        };

        console.log(`📱 PIX Manual configured for gallery ${galleryId}`);

        // Continue to confirm gallery - PIX Manual doesn't block
      }
      // Handle InfinitePay/MercadoPago/Asaas checkout
      else if (integracao && (integracao.provedor === 'infinitepay' || integracao.provedor === 'mercadopago' || integracao.provedor === 'asaas')) {
        
        // ——— ASAAS TRANSPARENT CHECKOUT: return data to frontend, don't create charge yet ———
        if (integracao.provedor === 'asaas') {
          const asaasSettings = (integracao.dados_extras || {}) as {
            habilitarPix?: boolean;
            habilitarCartao?: boolean;
            habilitarBoleto?: boolean;
            maxParcelas?: number;
            absorverTaxa?: boolean;
            taxaAntecipacao?: boolean;
            taxaAntecipacaoPercentual?: number;
            taxaAntecipacaoCreditoAvista?: number;
            taxaAntecipacaoCreditoParcelado?: number;
          };

          // Normalize session_id to text format
          let sessionIdTexto = gallery.session_id;
          if (sessionIdTexto && !sessionIdTexto.startsWith('workflow-') && !sessionIdTexto.startsWith('session_')) {
            const { data: sessao } = await supabase
              .from('clientes_sessoes')
              .select('session_id')
              .or(`id.eq.${sessionIdTexto},session_id.eq.${sessionIdTexto}`)
              .maybeSingle();
            sessionIdTexto = sessao?.session_id || sessionIdTexto;
          }

          const descricao = `${extrasACobrar} foto${extrasACobrar !== 1 ? 's' : ''} extra${extrasACobrar !== 1 ? 's' : ''} - ${gallery.nome_sessao || 'Galeria'}`;

          // Mark gallery as awaiting payment (status is set below in the common update)
          statusPagamento = 'pendente';
          paymentResponse = {
            provedor: 'asaas',
          };

          // Store checkout data for the response — charge created by frontend
          const asaasCheckoutData = {
            galeriaId: galleryId,
            userId: gallery.user_id,
            valorTotal,
            descricao,
            qtdFotos: extrasACobrar,
            clienteId: gallery.cliente_id,
            sessionId: sessionIdTexto,
            galleryToken: gallery.public_token,
            visitorId: visitorId || undefined,
            enabledMethods: {
              pix: asaasSettings.habilitarPix !== false,
              creditCard: asaasSettings.habilitarCartao !== false,
              boleto: asaasSettings.habilitarBoleto === true,
            },
            maxParcelas: asaasSettings.maxParcelas || 12,
            absorverTaxa: asaasSettings.absorverTaxa || false,
            ireiAntecipar: asaasSettings.ireiAntecipar ?? asaasSettings.incluirTaxaAntecipacao ?? false,
            repassarTaxaAntecipacao: asaasSettings.repassarTaxaAntecipacao ?? asaasSettings.incluirTaxaAntecipacao ?? false,
            taxaAntecipacao: asaasSettings.taxaAntecipacao || false,
            taxaAntecipacaoPercentual: asaasSettings.taxaAntecipacaoPercentual,
            taxaAntecipacaoCreditoAvista: asaasSettings.taxaAntecipacaoCreditoAvista,
            taxaAntecipacaoCreditoParcelado: asaasSettings.taxaAntecipacaoCreditoParcelado,
            incluirTaxaAntecipacao: asaasSettings.incluirTaxaAntecipacao ?? true,
            snapshotFotosIncluidas: gallery.fotos_incluidas || 0,
            snapshotRegrasCongeladas: gallery.regras_congeladas,
            correlationId,
          };

          console.log(`💳 Asaas transparent checkout prepared for gallery ${galleryId}, R$ ${valorTotal}`);

          // We'll still continue to the gallery update section, but override the final response
          // Store the data so we can return it at the end
          (paymentResponse as Record<string, unknown>).__asaasCheckoutData = asaasCheckoutData;
          // Skip the external payment creation — continue to gallery update
        }
        // ——— InfinitePay / MercadoPago: pipeline unificado ———
        // Contrato pipeline (.lovable/pipeline-galeria-pagamento.md): a criação
        // do link SEMPRE passa por `gallery-create-payment`, nunca chama
        // *-create-link diretamente. gcp é a fonte única de valor/qtd, faz
        // cancelamento de cobranças antigas e escolhe provedor com fallback.
        else {
        try {
          const gcpUrl = `${supabaseUrl}/functions/v1/gallery-create-payment`;
          console.log(`[confirm-selection] Delegating to gallery-create-payment (provider=${integracao.provedor}) with preloaded…`);

          // Fase 2: envia payload preloaded para que gcp pule SELECT galerias,
          // RPC canônica e SELECT usuarios_integracoes que já fizemos aqui.
          // Fast-path só é aceito porque estamos autenticando com service key.
          let sessionIdTextoPre: string | null = null;
          if (gallery.session_id) {
            if (gallery.session_id.startsWith('workflow-') || gallery.session_id.startsWith('session_')) {
              sessionIdTextoPre = gallery.session_id;
            }
          }

          const strictValorTotal = typeof valorTotal === 'number' && !Number.isNaN(valorTotal) ? valorTotal : Number(valorTotal) || 0;
          const strictExtras = typeof extrasACobrar === 'number' && !Number.isNaN(extrasACobrar) ? extrasACobrar : Number(extrasACobrar) || 0;

          if (strictValorTotal <= 0) {
            console.error(`🚨 [confirm-selection] GCP bypass: Tentando criar pagamento com valor nulo/zero.`, { valorTotal, strictValorTotal });
          }

          const gcpBody: Record<string, unknown> = {
              galleryId,
              provider: integracao.provedor,
              context: 'confirm_selection',
              expectedVersion: EXPECTED_GCP_VERSION,
              bypassPreSelecaoGate: true,
              visitorId: visitorId || undefined,
              snapshotFotosIncluidas: gallery.fotos_incluidas || 0,
              snapshotRegrasCongeladas: gallery.regras_congeladas,
              correlationId,
              preloaded: {
                gallery: {
                  id: galleryId,
                  user_id: gallery.user_id,
                  cliente_id: gallery.cliente_id || null, // [v2.2.1-final (deploy 2026-08-03)] Garantir null em galeria pública
                  session_id: gallery.session_id,
                  nome_sessao: gallery.nome_sessao,
                  public_token: galleryToken,
                  fotos_incluidas: gallery.fotos_incluidas,
                  regras_congeladas: gallery.regras_congeladas,
                },
                valorCanonico: strictValorTotal,
                extrasACobrar: strictExtras,
                isFullyPaid: false,
                provedor: integracao.provedor,
                sessionIdTexto: sessionIdTextoPre,
              },
          };

          const postGcp = (extra?: Record<string, unknown>) => fetch(gcpUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify(extra ? { ...gcpBody, ...extra } : gcpBody),
          });

          const readGcp = async (res: Response): Promise<Record<string, unknown> | null> => {
            const ct = res.headers.get('content-type') || '';
            if (ct.includes('application/json')) return await res.json();
            const textBody = await res.text();
            console.error(`❌ gallery-create-payment returned non-JSON (${ct}):`, textBody.substring(0, 300));
            return null;
          };

          let gcpResponse = await postGcp();
          let paymentData = await readGcp(gcpResponse);

          // ── Detecção de drift de versão (build publicada != HEAD) ──
          const gotVersion = (paymentData?.version as string) || gcpResponse.headers.get('x-gcp-version') || 'unknown';
          if (gotVersion !== EXPECTED_GCP_VERSION) {
            console.warn(`⚠️ PIPELINE_VERSION_DRIFT expected=${EXPECTED_GCP_VERSION} got=${gotVersion}`);
          }

          // ── Shim de compatibilidade com build legada do gcp ──
          // Build antiga exige clienteId/sessionId/valorTotal no body raiz.
          const legacyNeedsCliente =
            gcpResponse.status === 400 &&
            /clienteid/i.test(String(paymentData?.error ?? ''));

          if (legacyNeedsCliente) {
            console.warn('⚠️ GCP_LEGACY_FALLBACK — build antiga detectada, repetindo com payload legado');
            gcpResponse = await postGcp({
              clienteId: gallery.cliente_id || null,
              sessionId: sessionIdTextoPre || gallery.session_id || null,
              valorTotal,
              extraCount: extrasACobrar,
              descricao: `Fotos extras — ${gallery.nome_sessao || 'Galeria'}`,
            });
            paymentData = await readGcp(gcpResponse);
          }

          console.log(`[confirm-selection] gcp response (status ${gcpResponse.status}, version ${gotVersion}):`, JSON.stringify({
            success: paymentData?.success,
            provedor: paymentData?.provedor,
            code: paymentData?.code,
            error: paymentData?.error,
          }));

          if (gcpResponse.ok && paymentData?.success) {
            const checkoutUrl = paymentData.checkoutUrl as string | undefined;
            const cobrancaId = paymentData.cobrancaId as string | undefined;
            const provedorFinal = (paymentData.provedor as string) || integracao.provedor;

            paymentResponse = {
              checkoutUrl,
              provedor: provedorFinal,
              cobrancaId,
            };
            statusPagamento = 'pendente';
            console.log(`💳 Payment created via gcp: ${cobrancaId} @ ${provedorFinal}`);
          } else {
            const errorMsg = (paymentData?.error as string) || 'Falha na criação do link de pagamento';
            let errorCode = (paymentData?.code as string) || 'PAYMENT_CREATE_ERROR';
            const errorDetails = (paymentData?.details as string) || '';

            const isOverchargeReject =
              errorCode === 'CHARGE_DB_ERROR' &&
              /excederia o saldo|maior que o valor/i.test(errorDetails);
            const outMsg = isOverchargeReject
              ? 'O valor calculado ficou acima do saldo devido. Atualize a página e tente novamente — se persistir, contate o fotógrafo.'
              : errorMsg;
            if (isOverchargeReject) errorCode = 'CHARGE_OVERCHARGE';

            console.error(`❌ CRITICAL: gcp failed: [${errorCode}] ${errorMsg} ${errorDetails}`);

            await rollbackGalleryStatus();
            return new Response(
              JSON.stringify({ error: outMsg, code: errorCode, details: errorDetails }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } catch (payErr) {
          console.error('❌ CRITICAL: gcp fetch error:', payErr);
          await rollbackGalleryStatus();
          return new Response(
            JSON.stringify({
              error: 'Erro ao processar cobrança. Tente novamente.',
              code: 'PAYMENT_ERROR',
              details: payErr instanceof Error ? payErr.message : 'Erro desconhecido'
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        } // End of else block for InfinitePay/MercadoPago
      } else {
        // No payment provider configured but payment was required
        console.error('❌ CRITICAL: No payment provider configured for user but payment required');
        
        await rollbackGalleryStatus();
        return new Response(
          JSON.stringify({
            error: 'Nenhum método de pagamento configurado. Configure nas configurações.',
            code: 'NO_PAYMENT_PROVIDER'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 7. CRITICAL SAFETY CHECK: If payment was required, BLOCK gallery confirmation if checkout failed
    if (shouldCreatePayment && (!paymentResponse || (!paymentResponse.checkoutUrl && !paymentResponse.provedor))) {
      console.error('❌ CRITICAL: Payment was required but no response/link generated. Blocking gallery finalization.');
      await rollbackGalleryStatus();
      return new Response(
        JSON.stringify({
          error: 'Erro ao gerar link de pagamento. Por favor, tente novamente.',
          code: 'PAYMENT_GENERATION_FAILED'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Confirm gallery selection (atomic status update)
    // CRITICAL: Selection is considered finished even if payment is pending.
    // status: 'selecao_completa' (dashboard Concluída)
    // status_selecao: 'aguardando_pagamento' (client logic shows payment)
    const shouldFinalizeSelection = true; // Always finalize selection when confirm-selection is successful

    if (visitorId) {
      // ── PUBLIC GALLERY: Update visitor ──
      const visitorUpdateData: Record<string, unknown> = {
        status: 'finalizado',
        status_selecao: shouldCreatePayment ? 'aguardando_pagamento' : 'selecao_completa',
        fotos_selecionadas: selectedCount || 0,
        finalized_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: visitorUpdateError } = await supabase
        .from('galeria_visitantes')
        .update(visitorUpdateData)
        .eq('id', visitorId);

      if (visitorUpdateError) {
        console.error('Visitor update error:', visitorUpdateError);
        await rollbackGalleryStatus();
        return new Response(
          JSON.stringify({ error: 'Erro ao confirmar seleção' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ⚠️ NÃO incrementar total_fotos_extras_vendidas/valor_total_vendido aqui.
      // Esses agregados são consolidados EXCLUSIVAMENTE pela RPC finalize_gallery_payment
      // (via SUM idempotente das cobranças pagas). Incrementar aqui causa double-count
      // quando a cobrança é depois paga (manual ou via gateway).

      // Add PIX data to gallery configuracoes if PIX Manual
      if (paymentResponse?.provedor === 'pix_manual') {
        const integracaoPixManual = await supabase
          .from('usuarios_integracoes')
          .select('dados_extras')
          .eq('user_id', gallery.user_id)
          .eq('provedor', 'pix_manual')
          .eq('status', 'ativo')
          .maybeSingle();
        if (integracaoPixManual.data) {
          await supabase.from('galerias').update({
            configuracoes: { ...gallery.configuracoes, pixDados: integracaoPixManual.data.dados_extras },
          }).eq('id', galleryId);
        }
      }

      console.log(`✅ Visitor ${visitorId} selection confirmed: ${selectedCount} photos, finalize=${shouldFinalizeNow}`);
    } else {
      // ── PRIVATE GALLERY: Original flow — update gallery directly ──
      const updateData: Record<string, unknown> = {
        status: 'selecao_completa', // Now always set to completed so dashboard shows "Concluída"
        status_selecao: shouldCreatePayment ? 'aguardando_pagamento' : 'selecao_completa',
        finalized_at: new Date().toISOString(),
        fotos_selecionadas: selectedCount || 0,
        valor_extras: valorTotal,
        status_pagamento: statusPagamento,
        updated_at: new Date().toISOString(),
      };

      // Add PIX data to configuracoes if PIX Manual
      if (paymentResponse?.provedor === 'pix_manual') {
        const integracao = await supabase
          .from('usuarios_integracoes')
          .select('dados_extras')
          .eq('user_id', gallery.user_id)
          .eq('provedor', 'pix_manual')
          .eq('status', 'ativo')
          .maybeSingle();
        if (integracao.data) {
          updateData.configuracoes = { ...gallery.configuracoes, pixDados: integracao.data.dados_extras };
        }
      }

      const { error: updateError } = await supabase
        .from('galerias')
        .update(updateData)
        .eq('id', galleryId);

      if (updateError) {
        console.error('Gallery update error:', updateError);
        await rollbackGalleryStatus();
        return new Response(
          JSON.stringify({ error: 'Erro ao confirmar seleção' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fase 3 — Post-response non-blocking:
    // Histórico, sync com Gestão e audit_log NÃO precisam bloquear o response.
    // O `checkoutUrl` já pode ir para o frontend; estas escritas continuam
    // em background via EdgeRuntime.waitUntil quando disponível.
    const backgroundTasks = async () => {
      try {
        const { error: logError } = await supabase.from('galeria_acoes').insert({
          galeria_id: galleryId,
          tipo: 'cliente_confirmou',
          descricao: `Cliente confirmou seleção de ${selectedCount || 0} fotos${extrasACobrar ? ` (${extrasACobrar} extras - R$ ${valorTotal.toFixed(2)})` : ''}`,
          user_id: null,
        });
        if (logError) console.error('[bg] Log insert error:', logError);
      } catch (e) { console.error('[bg] galeria_acoes insert exc:', e); }

      if (gallery.session_id) {
        try {
          const syncResult = await syncSessionOnFinalize({
            supabase,
            galleryId,
            sessionId: gallery.session_id,
            correlationId,
          });
          if (!syncResult.ok && !syncResult.skipped) {
            console.warn(`[bg] ⚠️ gallery-update-session-photos falhou (status=${syncResult.status}): ${JSON.stringify(syncResult.body)} — trigger cobre o estado`);
          } else if (syncResult.ok && !syncResult.skipped) {
            console.log(`[bg] ✅ Sessão ${gallery.session_id} sincronizada via edge Gestão`);
          }
        } catch (e) { console.error('[bg] syncSessionOnFinalize exc:', e); }
      }

      try {
        const { error: auditErr } = await supabase.from('audit_log').insert({
          action: 'confirm_selection',
          actor_type: 'client',
          ip_address: clientIp,
          resource_type: 'gallery',
          resource_id: galleryId,
          gallery_id: galleryId,
          user_agent: req.headers.get('user-agent') || null,
          metadata: {
            selectedCount,
            extrasACobrar,
            valorTotal,
            valorUnitario,
            paymentRequired: shouldCreatePayment,
            provedor: paymentResponse?.provedor || null,
          },
        });
        if (auditErr) console.warn('[bg] Audit log error:', auditErr.message);
      } catch (e) { console.error('[bg] audit_log insert exc:', e); }
    };

    const bgPromise = backgroundTasks();
    // @ts-ignore — EdgeRuntime é injetado no runtime Deno Deploy do Supabase
    if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function') {
      // @ts-ignore
      EdgeRuntime.waitUntil(bgPromise);
    } else {
      // Fallback: dispara sem await (a Promise continua rodando após o return)
      bgPromise.catch((e) => console.error('[bg] tasks failed:', e));
    }

    console.log(`✅ Gallery ${galleryId} selection confirmed with ${selectedCount} photos, status_pagamento=${statusPagamento}`);



    // 9. Return response based on payment type
    // 🛡️ CRITICAL SAFETY CHECK: If payment was required but not created, BLOCK finalization
    if (shouldCreatePayment && (!paymentResponse || (!paymentResponse.checkoutUrl && paymentResponse.provedor !== 'pix_manual' && paymentResponse.provedor !== 'asaas'))) {
      console.error(`❌ CRITICAL: Payment was required (R$ ${valorTotal}) but no checkout link was generated. Provider: ${paymentResponse?.provedor || 'none'}, Mode: ${saleMode}`);
      await rollbackGalleryStatus();
      return errorResponse('Erro ao gerar link de pagamento. Por favor, tente novamente ou entre em contato com o suporte.', 500, 'PAYMENT_LINK_FAILED');
    }

    if (paymentResponse?.provedor === 'pix_manual') {
      const integracao = await supabase
        .from('usuarios_integracoes')
        .select('dados_extras')
        .eq('user_id', gallery.user_id)
        .eq('provedor', 'pix_manual')
        .eq('status', 'ativo')
        .maybeSingle();

      return new Response(
        JSON.stringify({
          success: true,
          selectedCount,
          extraCount: extrasCount,
          valorUnitario,
          valorTotal,
          message: 'Seleção confirmada com sucesso',
          requiresPayment: true,
          paymentMethod: 'pix_manual',
          pixData: integracao.data?.dados_extras,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Asaas transparent checkout - return data for frontend to create charge
    const asaasCheckoutData = (paymentResponse as Record<string, unknown> | null)?.__asaasCheckoutData;
    if (paymentResponse?.provedor === 'asaas' && asaasCheckoutData) {
      return new Response(
        JSON.stringify({
          success: true,
          selectedCount,
          extraCount: extrasCount,
          valorUnitario,
          valorTotal,
          message: 'Seleção confirmada com sucesso',
          requiresPayment: true,
          provedor: 'asaas',
          transparentCheckout: true,
          asaasCheckoutData,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return successResponse({
      success: true,
      selectedCount,
      extraCount: extrasCount,
      valorUnitario,
      valorTotal,
      message: 'Seleção confirmada com sucesso',
      requiresPayment: !!paymentResponse,
      checkoutUrl: paymentResponse?.checkoutUrl,
      provedor: paymentResponse?.provedor,
      cobrancaId: paymentResponse?.cobrancaId,
    });
  } catch (error) {
    console.error('Confirm selection error:', error);
    return errorResponse('Erro interno do servidor', 500);
  }

});
