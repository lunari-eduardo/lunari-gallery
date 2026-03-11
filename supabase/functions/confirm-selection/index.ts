import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface RequestBody {
  galleryId: string;
  selectedCount: number;
  extraCount?: number;
  valorUnitario?: number;
  valorTotal?: number;
  requestPayment?: boolean; // If true, create payment link
}

// Pricing calculation interfaces (mirrored from pricingUtils.ts)
interface FaixaPreco {
  min: number;
  max: number | null;
  valor: number;
}

interface TabelaPrecos {
  faixas: FaixaPreco[];
}

interface PrecificacaoFotoExtra {
  modelo: 'fixo' | 'global' | 'categoria';
  valorFixo?: number;
  tabelaGlobal?: TabelaPrecos;
  tabelaCategoria?: TabelaPrecos;
}

interface RegrasCongeladas {
  modelo: string;
  pacote?: {
    valorFotoExtra?: number;
  };
  precificacaoFotoExtra?: PrecificacaoFotoExtra;
}

// Normalize value from cents to reals if needed
function normalizarValor(valor: number): number {
  if (valor > 1000) {
    return valor / 100;
  }
  return valor;
}

// Calculate progressive pricing with CREDIT SYSTEM
// Formula: valor_a_cobrar = (total_extras × valor_faixa) - valor_já_pago
// This ensures the client pays the same total regardless of number of selection cycles
function calcularPrecoProgressivoComCredito(
  extrasNovas: number,           // New extras selected in this cycle
  extrasPagasTotal: number,       // Extras already paid from previous cycles (quantity)
  valorJaPago: number,            // Total amount already paid for extras (R$)
  regrasCongeladas: RegrasCongeladas | null | undefined,
  valorFotoExtraFixo: number
): { valorUnitario: number; valorACobrar: number; valorTotalIdeal: number; totalExtras: number } {
  // Calculate total accumulated extras
  const totalExtras = extrasPagasTotal + extrasNovas;
  
  // Normalize fallback value
  const fallbackValue = normalizarValor(valorFotoExtraFixo);
  
  // No extras = no charge
  if (extrasNovas <= 0 || totalExtras <= 0) {
    return {
      valorUnitario: 0,
      valorACobrar: 0,
      valorTotalIdeal: valorJaPago,
      totalExtras: extrasPagasTotal,
    };
  }

  // Get base package price
  const valorPacoteRaw = regrasCongeladas?.pacote?.valorFotoExtra || valorFotoExtraFixo;
  const precoBasePacote = normalizarValor(valorPacoteRaw);

  // No frozen rules = use fixed price with credit system
  if (!regrasCongeladas) {
    const valorTotalIdeal = totalExtras * fallbackValue;
    const valorACobrar = Math.max(0, valorTotalIdeal - valorJaPago);
    return {
      valorUnitario: fallbackValue,
      valorACobrar,
      valorTotalIdeal,
      totalExtras,
    };
  }

  const precificacao = regrasCongeladas.precificacaoFotoExtra;
  const modelo = precificacao?.modelo || regrasCongeladas.modelo || 'fixo';
  
  let valorUnitario = precoBasePacote;

  // Fixed model
  if (modelo === 'fixo') {
    valorUnitario = normalizarValor(
      precificacao?.valorFixo ||
        regrasCongeladas.pacote?.valorFotoExtra ||
        valorFotoExtraFixo
    );
  }
  // Progressive model (global or category)
  else {
    let tabela: TabelaPrecos | undefined;

    if (modelo === 'categoria' && precificacao?.tabelaCategoria) {
      tabela = precificacao.tabelaCategoria;
    } else if (precificacao?.tabelaGlobal) {
      tabela = precificacao.tabelaGlobal;
    }

    if (tabela && tabela.faixas && tabela.faixas.length > 0) {
      // Find matching tier using TOTAL accumulated extras
      const faixaAtual = tabela.faixas.find((faixa) => {
        const dentroDaFaixa = totalExtras >= faixa.min;
        const dentroDoMaximo = faixa.max === null || totalExtras <= faixa.max;
        return dentroDaFaixa && dentroDoMaximo;
      });

      // If no tier found, try the highest tier (for quantities beyond all ranges)
      if (faixaAtual) {
        valorUnitario = normalizarValor(faixaAtual.valor);
      } else {
        // Use highest tier for quantities beyond defined ranges
        const faixasOrdenadas = [...tabela.faixas].sort((a, b) => b.min - a.min);
        if (faixasOrdenadas.length > 0) {
          valorUnitario = normalizarValor(faixasOrdenadas[0].valor);
        }
      }
    }
  }

  // Ensure we have a valid price
  if (!valorUnitario || valorUnitario <= 0) {
    valorUnitario = fallbackValue;
  }

  // CREDIT SYSTEM FORMULA:
  // 1. Calculate what the total WOULD cost if bought all at once
  const valorTotalIdeal = totalExtras * valorUnitario;
  
  // 2. Subtract what was already paid
  const valorACobrar = Math.max(0, valorTotalIdeal - valorJaPago);

  console.log(`📊 Credit-based pricing: totalExtras=${totalExtras}, valorUnitario=${valorUnitario}, valorTotalIdeal=${valorTotalIdeal}, valorJaPago=${valorJaPago}, valorACobrar=${valorACobrar}`);

  return {
    valorUnitario,
    valorACobrar,
    valorTotalIdeal,
    totalExtras,
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();
    const { galleryId, selectedCount, extraCount, requestPayment } = body;

    // Validate required fields
    if (!galleryId) {
      return new Response(
        JSON.stringify({ error: 'galleryId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Acquire atomic lock on gallery to prevent concurrent confirmations
    const { data: lockResult, error: lockError } = await supabase.rpc('try_lock_gallery_selection', {
      p_gallery_id: galleryId,
    });

    if (lockError) {
      console.error('Lock RPC error:', lockError);
      return new Response(
        JSON.stringify({ error: 'Erro ao processar seleção' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!lockResult?.locked) {
      const reason = lockResult?.reason || 'unknown';
      console.log(`🔒 Gallery ${galleryId} lock denied: ${reason}`);
      return new Response(
        JSON.stringify({ error: 'A seleção desta galeria já está sendo processada ou foi confirmada', code: 'ALREADY_PROCESSING', reason }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Gallery data returned from the lock RPC
    const gallery = lockResult.gallery as {
      id: string; status: string; status_selecao: string; finalized_at: string | null;
      user_id: string; session_id: string | null; cliente_id: string | null;
      fotos_incluidas: number; valor_foto_extra: number; nome_sessao: string | null;
      configuracoes: Record<string, unknown> | null; public_token: string | null;
      total_fotos_extras_vendidas: number | null; valor_total_vendido: number | null;
      regras_congeladas: Record<string, unknown> | null;
    };

    // 3. Calculate progressive pricing using CREDIT SYSTEM
    // Formula: valor_a_cobrar = (total_extras × valor_faixa) - valor_já_pago
    let valorUnitario = 0;
    let valorTotal = 0;
    
    // Parse sale settings to get chargeType
    const configuracoes = gallery.configuracoes as { saleSettings?: { mode?: string; paymentMethod?: string; chargeType?: string } } | null;
    const chargeType = configuracoes?.saleSettings?.chargeType || 'only_extras';
    
    // Calculate extras needed based on chargeType:
    // - 'all_selected': charge for ALL selected photos (for public/paid galleries)
    // - 'only_extras': charge only for photos beyond the included limit (default)
    const extrasNecessarias = chargeType === 'all_selected'
      ? (selectedCount || 0)  // ALL selected photos are chargeable
      : Math.max(0, (selectedCount || 0) - (gallery.fotos_incluidas || 0));  // Only extras
    
    console.log(`📊 ChargeType: ${chargeType}, selectedCount=${selectedCount}, fotosIncluidas=${gallery.fotos_incluidas}, extrasNecessarias=${extrasNecessarias}`);
    
    // Get previously paid extras from gallery record
    const extrasPagasTotal = gallery.total_fotos_extras_vendidas || 0;
    const valorJaPago = gallery.valor_total_vendido || 0;
    
    // Calculate only the extras that need to be charged (quantity not yet paid)
    const extrasACobrar = Math.max(0, extrasNecessarias - extrasPagasTotal);
    
    // For response/display, use extrasNecessarias
    const extrasCount = extraCount ?? extrasNecessarias;
    
    console.log(`📊 Extras calculation: necessarias=${extrasNecessarias}, pagas=${extrasPagasTotal}, a_cobrar=${extrasACobrar}, valorJaPago=R$${valorJaPago}`);

    // Try to get regras: session first, then gallery's own (standalone mode)
    let regrasCongeladasSource: RegrasCongeladas | null = null;
    let fallbackPrice = gallery.valor_foto_extra || 0;

    if (gallery.session_id) {
      // Fetch session data with frozen rules (Gestão flow)
      const { data: sessao, error: sessaoError } = await supabase
        .from('clientes_sessoes')
        .select('id, regras_congeladas, valor_foto_extra')
        .eq('session_id', gallery.session_id)
        .single();

      if (sessaoError) {
        console.warn('Session fetch error:', sessaoError.message);
      }

      if (sessao?.regras_congeladas) {
        console.log('📊 Using regrasCongeladas from session (Gestão mode)');
        regrasCongeladasSource = sessao.regras_congeladas as RegrasCongeladas;
        fallbackPrice = sessao.valor_foto_extra || gallery.valor_foto_extra || 0;
      }
    }

    // Fallback: check gallery's own regrasCongeladas (standalone mode with discount packages)
    if (!regrasCongeladasSource && gallery.regras_congeladas) {
      console.log('📊 Using regrasCongeladas from gallery (standalone mode)');
      regrasCongeladasSource = gallery.regras_congeladas as RegrasCongeladas;
    }

    // Calculate using credit system with whatever regras we found (or null)
    const resultado = calcularPrecoProgressivoComCredito(
      extrasACobrar,
      extrasPagasTotal,
      valorJaPago,
      regrasCongeladasSource,
      fallbackPrice
    );
    valorUnitario = resultado.valorUnitario;
    valorTotal = resultado.valorACobrar;

    console.log(`📊 Credit-based pricing: modelo=${regrasCongeladasSource ? 'progressivo' : 'fixo'}, valorTotalIdeal=R$${resultado.valorTotalIdeal}, valorJaPago=R$${valorJaPago}, valorACobrar=R$${valorTotal}`);

    // 4. Parse sale settings to determine if payment is required
    // CRITICAL: Decision is 100% server-side — frontend's requestPayment is IGNORED
    // (configuracoes already parsed above for chargeType)
    const saleMode = configuracoes?.saleSettings?.mode;
    const configuredPaymentMethod = configuracoes?.saleSettings?.paymentMethod;
    // Server-side rule: if mode is sale_with_payment AND there's value to charge, payment is required
    const shouldCreatePayment = saleMode === 'sale_with_payment' && valorTotal > 0 && extrasACobrar > 0;

    console.log(`💰 Payment check: mode=${saleMode}, valorTotal=${valorTotal}, extrasACobrar=${extrasACobrar}, shouldCreate=${shouldCreatePayment} (server-side, requestPayment from frontend IGNORED)`);

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
            enabledMethods: {
              pix: asaasSettings.habilitarPix !== false,
              creditCard: asaasSettings.habilitarCartao !== false,
              boleto: asaasSettings.habilitarBoleto === true,
            },
            maxParcelas: asaasSettings.maxParcelas || 12,
            absorverTaxa: asaasSettings.absorverTaxa || false,
            taxaAntecipacao: asaasSettings.taxaAntecipacao || false,
            taxaAntecipacaoPercentual: asaasSettings.taxaAntecipacaoPercentual,
            taxaAntecipacaoCreditoAvista: asaasSettings.taxaAntecipacaoCreditoAvista,
            taxaAntecipacaoCreditoParcelado: asaasSettings.taxaAntecipacaoCreditoParcelado,
            incluirTaxaAntecipacao: asaasSettings.incluirTaxaAntecipacao ?? true,
          };

          console.log(`💳 Asaas transparent checkout prepared for gallery ${galleryId}, R$ ${valorTotal}`);

          // We'll still continue to the gallery update section, but override the final response
          // Store the data so we can return it at the end
          (paymentResponse as Record<string, unknown>).__asaasCheckoutData = asaasCheckoutData;
          // Skip the external payment creation — continue to gallery update
        }
        // ——— InfinitePay / MercadoPago: external checkout ———
        else {
        let functionName: string;
        if (integracao.provedor === 'infinitepay') {
          functionName = 'infinitepay-create-link';
        } else {
          functionName = 'mercadopago-create-link';
        }

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

        try {
          // Use fetch() directly instead of supabase.functions.invoke() to get full error details
          const functionUrl = `${supabaseUrl}/functions/v1/${functionName}`;
          console.log(`💳 Calling ${functionName} via fetch()...`);
          
          const paymentFetchResponse = await fetch(functionUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              clienteId: gallery.cliente_id,
              sessionId: sessionIdTexto,
              valor: valorTotal,
              descricao,
              userId: gallery.user_id,
              galleryToken: gallery.public_token,
              galeriaId: galleryId,
              qtdFotos: extrasACobrar,
            }),
          });

          let paymentData: Record<string, unknown> | null = null;
          const paymentContentType = paymentFetchResponse.headers.get('content-type') || '';
          
          if (paymentContentType.includes('application/json')) {
            paymentData = await paymentFetchResponse.json();
          } else {
            const textBody = await paymentFetchResponse.text();
            console.error(`❌ ${functionName} returned non-JSON (${paymentContentType}):`, textBody.substring(0, 300));
          }

          console.log(`💳 Payment response (status ${paymentFetchResponse.status}):`, JSON.stringify({
            success: paymentData?.success,
            error: paymentData?.error,
            code: paymentData?.code,
          }));

          if (paymentFetchResponse.ok && paymentData?.success) {
            const checkoutUrl = paymentData.checkoutUrl || paymentData.paymentLink || paymentData.checkout_url;
            const cobrancaId = paymentData.cobrancaId || (paymentData.cobranca as Record<string, unknown>)?.id || paymentData.cobranca_id;

            paymentResponse = {
              checkoutUrl: checkoutUrl as string,
              provedor: integracao.provedor,
              cobrancaId: cobrancaId as string,
            };

            statusPagamento = 'pendente';
            console.log(`💳 Payment created successfully: ${cobrancaId} via ${integracao.provedor}`);
          } else {
            const errorMsg = (paymentData?.error as string) || 'Falha na criação do link de pagamento';
            const errorCode = (paymentData?.code as string) || 'PAYMENT_FAILED';
            const errorDetails = (paymentData?.details as string) || '';
            console.error(`❌ CRITICAL: Payment creation failed: [${errorCode}] ${errorMsg} ${errorDetails}`);
            
            return new Response(
              JSON.stringify({
                error: errorMsg,
                code: errorCode,
                details: errorDetails,
              }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } catch (payErr) {
          console.error('❌ CRITICAL: Payment fetch error:', payErr);
          
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
        
        return new Response(
          JSON.stringify({
            error: 'Nenhum método de pagamento configurado. Configure nas configurações.',
            code: 'NO_PAYMENT_PROVIDER'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 6. NOW it's safe to confirm selection - payment was created successfully (if required)
    // CONDITIONAL FINALIZATION: Only finalize immediately if no payment is required
    // For PIX Manual, InfinitePay, MercadoPago: set aguardando_pagamento, finalize later
    const shouldFinalizeNow = !shouldCreatePayment;
    
    const updateData: Record<string, unknown> = {
      status: 'selecao_completa',
      status_selecao: shouldFinalizeNow ? 'selecao_completa' : 'aguardando_pagamento',
      finalized_at: shouldFinalizeNow ? new Date().toISOString() : null,
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
        updateData.configuracoes = {
          ...gallery.configuracoes,
          pixDados: integracao.data.dados_extras
        };
      }
    }

    const { error: updateError } = await supabase
      .from('galerias')
      .update(updateData)
      .eq('id', galleryId);

    if (updateError) {
      console.error('Gallery update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao confirmar seleção' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Log action in history
    const { error: logError } = await supabase.from('galeria_acoes').insert({
      galeria_id: galleryId,
      tipo: 'cliente_confirmou',
      descricao: `Cliente confirmou seleção de ${selectedCount || 0} fotos${extrasCount ? ` (${extrasCount} extras - R$ ${valorTotal.toFixed(2)})` : ''}`,
      user_id: null,
    });

    if (logError) {
      console.error('Log insert error:', logError);
    }

    // 8. Sync with clientes_sessoes if gallery was created from Gestão
    // Use CUMULATIVE values for session to maintain accurate totals
    if (gallery.session_id) {
      // Calculate cumulative totals for session record
      const novoQtdFotosExtra = (gallery.total_fotos_extras_vendidas || 0) + extrasACobrar;
      const novoValorTotalFotoExtra = (gallery.valor_total_vendido || 0) + valorTotal;
      
      const { error: sessionError } = await supabase
        .from('clientes_sessoes')
        .update({
          qtd_fotos_extra: novoQtdFotosExtra, // CUMULATIVE: total extras across all cycles
          valor_foto_extra: valorUnitario, // Last unit price used
          valor_total_foto_extra: novoValorTotalFotoExtra, // CUMULATIVE: total value across all cycles
          // Only mark as concluida if finalizing now (no pending payment)
          status_galeria: shouldFinalizeNow ? 'selecao_completa' : 'em_selecao',
          updated_at: new Date().toISOString(),
        })
        .eq('session_id', gallery.session_id);

      if (sessionError) {
        console.error('Session update error:', sessionError);
      } else {
        console.log(`✅ Session ${gallery.session_id} updated: ${novoQtdFotosExtra} cumulative extras, R$ ${valorUnitario}/photo, total R$ ${novoValorTotalFotoExtra}, status=selecao_completa`);
      }
    }

    console.log(`✅ Gallery ${galleryId} selection confirmed with ${selectedCount} photos, status_pagamento=${statusPagamento}`);

    // 9. Return response based on payment type
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

    return new Response(
      JSON.stringify({
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
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Confirm selection error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
