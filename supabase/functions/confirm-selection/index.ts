import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // 1. Fetch gallery to validate status and get session_id + extras already paid
    const { data: gallery, error: galleryError } = await supabase
      .from('galerias')
      .select('id, status, status_selecao, finalized_at, user_id, session_id, cliente_id, fotos_incluidas, valor_foto_extra, nome_sessao, configuracoes, public_token, total_fotos_extras_vendidas, valor_total_vendido, regras_congeladas')
      .eq('id', galleryId)
      .single();

    if (galleryError || !gallery) {
      console.error('Gallery fetch error:', galleryError);
      return new Response(
        JSON.stringify({ error: 'Galeria não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Check if selection is already confirmed
    if (gallery.status_selecao === 'confirmado' || gallery.finalized_at) {
      return new Response(
        JSON.stringify({ error: 'A seleção desta galeria já foi confirmada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
    // (configuracoes already parsed above for chargeType)
    const saleMode = configuracoes?.saleSettings?.mode;
    const configuredPaymentMethod = configuracoes?.saleSettings?.paymentMethod;
    // Only create payment if there are extras to charge (respects credit system)
    const shouldCreatePayment = requestPayment && saleMode === 'sale_with_payment' && valorTotal > 0 && extrasACobrar > 0;

    console.log(`💰 Payment check: mode=${saleMode}, valorTotal=${valorTotal}, shouldCreate=${shouldCreatePayment}`);

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
          .in('provedor', ['mercadopago', 'infinitepay', 'pix_manual'])
          .maybeSingle();
        integracao = data;

        if (!integracao) {
          const { data: anyActive } = await supabase
            .from('usuarios_integracoes')
            .select('provedor, dados_extras')
            .eq('user_id', gallery.user_id)
            .eq('status', 'ativo')
            .in('provedor', ['mercadopago', 'infinitepay', 'pix_manual'])
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
      // Handle InfinitePay/MercadoPago checkout
      else if (integracao && (integracao.provedor === 'infinitepay' || integracao.provedor === 'mercadopago')) {
        const functionName = integracao.provedor === 'infinitepay'
          ? 'infinitepay-create-link'
          : 'mercadopago-create-link';

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
          console.log(`💳 Invoking ${functionName}...`);
          
          const { data: paymentData, error: paymentError } = await supabase.functions.invoke(functionName, {
            body: {
              clienteId: gallery.cliente_id,
              sessionId: sessionIdTexto,
              valor: valorTotal,
              descricao,
              userId: gallery.user_id,
              galleryToken: gallery.public_token, // For redirect URL
              galeriaId: galleryId, // Pass gallery ID for linking
              qtdFotos: extrasACobrar, // Pass quantity for credit tracking
            }
          });

          console.log(`💳 Payment response:`, { success: paymentData?.success, error: paymentError?.message || paymentData?.error });

          if (!paymentError && paymentData?.success) {
            // === NORMALIZAÇÃO ROBUSTA: aceita múltiplos formatos de resposta ===
            const checkoutUrl = paymentData.checkoutUrl || paymentData.paymentLink || paymentData.checkout_url;
            
            // Captura cobrancaId de múltiplos formatos possíveis
            const cobrancaId = paymentData.cobrancaId || paymentData.cobranca?.id || paymentData.cobranca_id;

            paymentResponse = {
              checkoutUrl,
              provedor: integracao.provedor,
              cobrancaId,
            };

            statusPagamento = 'pendente';
            console.log(`💳 Payment created successfully: ${cobrancaId} via ${integracao.provedor}`);
          } else {
            // CRITICAL: Payment creation FAILED - DO NOT confirm gallery!
            console.error('❌ CRITICAL: Payment creation failed:', paymentError?.message || paymentData?.error);
            
            return new Response(
              JSON.stringify({
                error: 'Erro ao criar cobrança. Tente novamente.',
                code: 'PAYMENT_FAILED',
                details: paymentError?.message || paymentData?.error || 'Falha na criação do link de pagamento'
              }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } catch (payErr) {
          // CRITICAL: Payment invocation error - DO NOT confirm gallery!
          console.error('❌ CRITICAL: Payment invocation error:', payErr);
          
          return new Response(
            JSON.stringify({
              error: 'Erro ao processar cobrança. Tente novamente.',
              code: 'PAYMENT_ERROR',
              details: payErr instanceof Error ? payErr.message : 'Erro desconhecido'
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
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
      status_selecao: shouldFinalizeNow ? 'confirmado' : 'aguardando_pagamento',
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
          status_galeria: shouldFinalizeNow ? 'concluida' : 'em_selecao',
          updated_at: new Date().toISOString(),
        })
        .eq('session_id', gallery.session_id);

      if (sessionError) {
        console.error('Session update error:', sessionError);
      } else {
        console.log(`✅ Session ${gallery.session_id} updated: ${novoQtdFotosExtra} cumulative extras, R$ ${valorUnitario}/photo, total R$ ${novoValorTotalFotoExtra}, status=concluida`);
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
