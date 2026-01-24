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

// Calculate progressive pricing based on frozen rules
function calcularPrecoProgressivo(
  quantidadeFotosExtras: number,
  regrasCongeladas: RegrasCongeladas | null | undefined,
  valorFotoExtraFixo: number
): { valorUnitario: number; valorTotal: number } {
  // No extras = no charge
  if (quantidadeFotosExtras <= 0) {
    return { valorUnitario: 0, valorTotal: 0 };
  }

  // Normalize fallback value
  const fallbackValue = normalizarValor(valorFotoExtraFixo);

  // No frozen rules = use fixed price
  if (!regrasCongeladas) {
    return {
      valorUnitario: fallbackValue,
      valorTotal: fallbackValue * quantidadeFotosExtras,
    };
  }

  const precificacao = regrasCongeladas.precificacaoFotoExtra;
  const modelo = precificacao?.modelo || regrasCongeladas.modelo || 'fixo';

  // Fixed model
  if (modelo === 'fixo') {
    const valorFixo = normalizarValor(
      precificacao?.valorFixo ||
        regrasCongeladas.pacote?.valorFotoExtra ||
        valorFotoExtraFixo
    );
    return {
      valorUnitario: valorFixo,
      valorTotal: valorFixo * quantidadeFotosExtras,
    };
  }

  // Progressive model (global or category)
  let tabela: TabelaPrecos | undefined;

  if (modelo === 'categoria' && precificacao?.tabelaCategoria) {
    tabela = precificacao.tabelaCategoria;
  } else if (precificacao?.tabelaGlobal) {
    tabela = precificacao.tabelaGlobal;
  }

  if (!tabela || !tabela.faixas || tabela.faixas.length === 0) {
    const valorPacote = normalizarValor(
      regrasCongeladas.pacote?.valorFotoExtra || valorFotoExtraFixo
    );
    return {
      valorUnitario: valorPacote,
      valorTotal: valorPacote * quantidadeFotosExtras,
    };
  }

  // Find matching tier
  const faixaAtual = tabela.faixas.find((faixa) => {
    const dentroDaFaixa = quantidadeFotosExtras >= faixa.min;
    const dentroDoMaximo = faixa.max === null || quantidadeFotosExtras <= faixa.max;
    return dentroDaFaixa && dentroDoMaximo;
  });

  if (faixaAtual) {
    const valorUnitario = normalizarValor(faixaAtual.valor);
    return {
      valorUnitario,
      valorTotal: valorUnitario * quantidadeFotosExtras,
    };
  }

  // If no tier found, use package price
  const valorPadrao = normalizarValor(
    regrasCongeladas.pacote?.valorFotoExtra || valorFotoExtraFixo
  );
  return {
    valorUnitario: valorPadrao,
    valorTotal: valorPadrao * quantidadeFotosExtras,
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
    const { galleryId, selectedCount, extraCount } = body;

    // Validate required fields
    if (!galleryId) {
      return new Response(
        JSON.stringify({ error: 'galleryId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Fetch gallery to validate status and get session_id
    const { data: gallery, error: galleryError } = await supabase
      .from('galerias')
      .select('id, status, status_selecao, finalized_at, user_id, session_id, fotos_incluidas, valor_foto_extra')
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

    // 3. Calculate progressive pricing from session rules (if linked to Gestão)
    let valorUnitario = 0;
    let valorTotal = 0;
    const extrasCount = extraCount || Math.max(0, (selectedCount || 0) - (gallery.fotos_incluidas || 0));

    if (gallery.session_id) {
      // Fetch session data with frozen rules
      // Note: gallery.session_id is the workflow string 'session_id' column
      const { data: sessao, error: sessaoError } = await supabase
        .from('clientes_sessoes')
        .select('id, regras_congeladas, valor_foto_extra')
        .eq('session_id', gallery.session_id)
        .single();

      if (sessaoError) {
        console.warn('Session fetch error:', sessaoError.message);
      }

      if (sessao) {
        console.log('📊 Session found, calculating progressive pricing...');
        const regras = sessao.regras_congeladas as RegrasCongeladas | null;
        const fallbackPrice = sessao.valor_foto_extra || gallery.valor_foto_extra || 0;

        const resultado = calcularPrecoProgressivo(extrasCount, regras, fallbackPrice);
        valorUnitario = resultado.valorUnitario;
        valorTotal = resultado.valorTotal;

        console.log(`📊 Pricing calculated: ${extrasCount} extras × R$ ${valorUnitario} = R$ ${valorTotal}`);
      }
    } else {
      // No session = use gallery's fixed price
      valorUnitario = gallery.valor_foto_extra || 0;
      valorTotal = valorUnitario * extrasCount;
    }

    // 4. Confirm selection - update gallery
    const { error: updateError } = await supabase
      .from('galerias')
      .update({
        status: 'selecao_completa',
        status_selecao: 'confirmado',
        finalized_at: new Date().toISOString(),
        fotos_selecionadas: selectedCount || 0,
        valor_extras: valorTotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', galleryId);

    if (updateError) {
      console.error('Gallery update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao confirmar seleção' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Log action in history (user_id can be null for client actions)
    const { error: logError } = await supabase.from('galeria_acoes').insert({
      galeria_id: galleryId,
      tipo: 'cliente_confirmou',
      descricao: `Cliente confirmou seleção de ${selectedCount || 0} fotos${extrasCount ? ` (${extrasCount} extras - R$ ${valorTotal.toFixed(2)})` : ''}`,
      user_id: null, // Anonymous client action
    });

    if (logError) {
      console.error('Log insert error:', logError);
    }

    // 6. Sync with clientes_sessoes if gallery was created from Gestão
    if (gallery.session_id) {
      // Note: gallery.session_id is the workflow string 'session_id' column
      const { error: sessionError } = await supabase
        .from('clientes_sessoes')
        .update({
          qtd_fotos_extra: extrasCount,
          valor_foto_extra: valorUnitario,
          valor_total_foto_extra: valorTotal,
          status_galeria: 'concluida',
          updated_at: new Date().toISOString(),
        })
        .eq('session_id', gallery.session_id);

      if (sessionError) {
        console.error('Session update error:', sessionError);
      } else {
        console.log(`✅ Session ${gallery.session_id} updated: ${extrasCount} extras, R$ ${valorUnitario}/photo, total R$ ${valorTotal}, status=concluida`);
      }
    }

    console.log(`✅ Gallery ${galleryId} selection confirmed with ${selectedCount} photos`);

    return new Response(
      JSON.stringify({
        success: true,
        selectedCount,
        extraCount: extrasCount,
        valorUnitario,
        valorTotal,
        message: 'Seleção confirmada com sucesso',
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
