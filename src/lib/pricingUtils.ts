/**
 * Progressive Pricing Utilities
 * Handles discount tiers for extra photos based on frozen rules from Gestão
 */

export interface FaixaPreco {
  min: number;
  max: number | null; // null = unlimited (8+, etc.)
  valor: number;
}

export interface TabelaPrecos {
  id?: string;
  nome?: string;
  faixas: FaixaPreco[];
  usar_valor_fixo_pacote?: boolean;
}

export interface PrecificacaoFotoExtra {
  modelo: 'fixo' | 'global' | 'categoria';
  valorFixo?: number;
  tabelaGlobal?: TabelaPrecos;
  tabelaCategoria?: TabelaPrecos;
}

export interface RegrasCongeladas {
  modelo: string;
  dataCongelamento?: string;
  pacote: {
    id?: string;
    nome?: string;
    valorBase?: number;
    valorFotoExtra: number;
    fotosIncluidas: number;
    categoria?: string;
    categoriaId?: string;
    produtosIncluidos?: any[];
  };
  precificacaoFotoExtra: PrecificacaoFotoExtra;
  produtos?: any[];
}

export interface CalculoPrecoResult {
  valorUnitario: number;
  valorTotal: number;
  faixaAtual?: FaixaPreco;
  economia?: number;
  modeloUsado: 'fixo' | 'global' | 'categoria';
}

/**
 * Normalizes a price value that might be in cents to reals.
 * If the value is > 1000, it's assumed to be in cents and divided by 100.
 * This handles Gestão's inconsistent storage of valores.
 * 
 * GUARD: Values between 0.01 and 1000 are assumed to already be in reals.
 * Values > 1000 are assumed to be in cents and will be converted.
 * This prevents double normalization that could cause incorrect pricing.
 */
export function normalizarValor(valor: number, forceSkip = false): number {
  // Guard: If explicitly skipping normalization
  if (forceSkip) {
    return valor;
  }
  
  // Guard: Values <= 0 return as-is
  if (valor <= 0) {
    return valor;
  }
  
  // Values > 1000 are assumed to be in cents (e.g., 2500 = R$ 25,00)
  // Values between 0.01 and 1000 are assumed to be already in reals
  if (valor > 1000) {
    console.log(`[pricingUtils] Normalizing cents to reals: ${valor} → ${valor / 100}`);
    return valor / 100;
  }
  
  return valor;
}

/**
 * Finds the price tier for the given quantity
 * Exported for use in Edge Functions as well
 */
export function encontrarFaixaPreco(quantidade: number, faixas: FaixaPreco[]): FaixaPreco | null {
  if (!faixas?.length || quantidade <= 0) return null;
  
  // Sort by min ascending
  const faixasOrdenadas = [...faixas].sort((a, b) => a.min - b.min);
  
  for (const faixa of faixasOrdenadas) {
    if (quantidade >= faixa.min && (faixa.max === null || quantidade <= faixa.max)) {
      return faixa;
    }
  }
  
  // If quantity exceeds all ranges, use the last one (highest tier)
  return faixasOrdenadas[faixasOrdenadas.length - 1] || null;
}

/**
 * Gets the unit price from a tier
 */
function encontrarValorNaFaixa(quantidade: number, faixas: FaixaPreco[]): number {
  const faixa = encontrarFaixaPreco(quantidade, faixas);
  return faixa?.valor || 0;
}

/**
 * Calculates the price for extra photos using progressive pricing rules
 * 
 * @param quantidadeFotosExtras - Number of photos beyond the included amount
 * @param regrasCongeladas - Frozen pricing rules from Gestão (or null)
 * @param valorFotoExtraFixo - Fallback fixed price per photo
 * @returns Calculation result with unit price, total, and savings
 */
/**
 * Calculates the price for extra photos using progressive pricing rules
 * 
 * @param quantidadeFotosExtras - Number of photos to charge in this cycle
 * @param regrasCongeladas - Frozen pricing rules from Gestão (or null)
 * @param valorFotoExtraFixo - Fallback fixed price per photo
 * @param quantidadeParaFaixa - Optional: total accumulated extras for tier calculation (if not provided, uses quantidadeFotosExtras)
 * @returns Calculation result with unit price, total, and savings
 */
export function calcularPrecoProgressivo(
  quantidadeFotosExtras: number,
  regrasCongeladas: RegrasCongeladas | null | undefined,
  valorFotoExtraFixo: number,
  quantidadeParaFaixa?: number // NEW: Optional - for cumulative tier lookup
): CalculoPrecoResult {
  // Use quantidadeParaFaixa for tier lookup, or fallback to quantity to charge
  const qtdParaBuscarFaixa = quantidadeParaFaixa ?? quantidadeFotosExtras;
  
  // Normalize fallback value (might be in cents from Gestão)
  const fallbackNormalizado = normalizarValor(valorFotoExtraFixo);

  // Default/fallback result
  const fallbackResult: CalculoPrecoResult = {
    valorUnitario: fallbackNormalizado,
    valorTotal: quantidadeFotosExtras * fallbackNormalizado,
    modeloUsado: 'fixo',
  };

  // No extras or no rules - use fixed price
  if (quantidadeFotosExtras <= 0) {
    return { ...fallbackResult, valorTotal: 0 };
  }

  if (!regrasCongeladas?.precificacaoFotoExtra) {
    return fallbackResult;
  }

  const regras = regrasCongeladas.precificacaoFotoExtra;
  // Normalize package base price (might be in cents from Gestão)
  const valorPacoteRaw = regrasCongeladas.pacote?.valorFotoExtra || valorFotoExtraFixo;
  const precoBasePacote = normalizarValor(valorPacoteRaw);
  
  let valorUnitario = 0;
  let faixaAtual: FaixaPreco | null = null;
  let modeloUsado: 'fixo' | 'global' | 'categoria' = 'fixo';

  switch (regras.modelo) {
    case 'fixo':
      valorUnitario = precoBasePacote;
      modeloUsado = 'fixo';
      break;
      
    case 'global':
      if (regras.tabelaGlobal?.faixas) {
        // Use qtdParaBuscarFaixa for tier lookup (cumulative total)
        faixaAtual = encontrarFaixaPreco(qtdParaBuscarFaixa, regras.tabelaGlobal.faixas);
        valorUnitario = faixaAtual?.valor || precoBasePacote;
        modeloUsado = 'global';
      } else {
        valorUnitario = precoBasePacote;
      }
      break;
      
    case 'categoria':
      // Check if should use fixed price from package
      if (regras.tabelaCategoria?.usar_valor_fixo_pacote) {
        valorUnitario = precoBasePacote;
        modeloUsado = 'fixo';
      } else if (regras.tabelaCategoria?.faixas) {
        // Use qtdParaBuscarFaixa for tier lookup (cumulative total)
        faixaAtual = encontrarFaixaPreco(qtdParaBuscarFaixa, regras.tabelaCategoria.faixas);
        valorUnitario = faixaAtual?.valor || precoBasePacote;
        modeloUsado = 'categoria';
      } else {
        valorUnitario = precoBasePacote;
      }
      break;
      
    default:
      valorUnitario = valorFotoExtraFixo;
  }

  // Ensure we have a valid price
  if (!valorUnitario || valorUnitario <= 0) {
    valorUnitario = valorFotoExtraFixo;
  }

  const valorTotal = valorUnitario * quantidadeFotosExtras;
  
  // Calculate savings compared to base price
  const valorSemDesconto = precoBasePacote * quantidadeFotosExtras;
  const economia = valorSemDesconto - valorTotal;

  return {
    valorUnitario,
    valorTotal,
    faixaAtual: faixaAtual || undefined,
    economia: economia > 0 ? economia : undefined,
    modeloUsado,
  };
}

/**
 * Result type for credit-based progressive pricing
 */
export interface CalculoPrecoComCreditoResult {
  valorUnitario: number;          // Unit price from the tier
  valorACobrar: number;           // Amount to charge this cycle
  valorTotalIdeal: number;        // What total would cost if bought at once
  economia: number;               // Savings vs base price
  totalExtras: number;            // Total accumulated extras
  faixaAtual?: FaixaPreco;        // Current price tier
  modeloUsado: 'fixo' | 'global' | 'categoria';
}

/**
 * Calculates progressive pricing with credit system
 * 
 * Formula: valor_a_cobrar = (total_extras × valor_faixa) - valor_já_pago
 * 
 * This ensures the client always pays the same total regardless of how many
 * selection cycles they go through.
 * 
 * @param extrasNovas - New extras selected in this cycle
 * @param extrasPagasTotal - Extras already paid from previous cycles (quantity)
 * @param valorJaPago - Total amount already paid for extras (R$)
 * @param regrasCongeladas - Frozen pricing rules from Gestão (or null)
 * @param valorFotoExtraFixo - Fallback fixed price per photo
 * @returns Calculation result with amount to charge and breakdown
 */
export function calcularPrecoProgressivoComCredito(
  extrasNovas: number,
  extrasPagasTotal: number,
  valorJaPago: number,
  regrasCongeladas: RegrasCongeladas | null | undefined,
  valorFotoExtraFixo: number
): CalculoPrecoComCreditoResult {
  // Calculate total accumulated extras
  const totalExtras = extrasPagasTotal + extrasNovas;
  
  // Normalize fallback value
  const fallbackNormalizado = normalizarValor(valorFotoExtraFixo);
  
  // Default result for no new extras - but still show correct unit price for display
  if (extrasNovas <= 0 || totalExtras <= 0) {
    // Calculate unit price for display even when there's nothing new to charge
    // Use the average price paid (valorJaPago / extrasPagasTotal) for accuracy
    let displayUnitPrice = fallbackNormalizado;
    
    if (extrasPagasTotal > 0 && valorJaPago > 0) {
      // Best approach: use actual average price paid
      displayUnitPrice = valorJaPago / extrasPagasTotal;
    } else if (regrasCongeladas?.precificacaoFotoExtra) {
      // Fallback: look up the tier price for previously paid quantity
      const regras = regrasCongeladas.precificacaoFotoExtra;
      const qtdParaFaixa = extrasPagasTotal > 0 ? extrasPagasTotal : 1;
      
      if (regras.modelo === 'global' && regras.tabelaGlobal?.faixas) {
        const faixa = encontrarFaixaPreco(qtdParaFaixa, regras.tabelaGlobal.faixas);
        if (faixa?.valor) displayUnitPrice = normalizarValor(faixa.valor);
      } else if (regras.modelo === 'categoria' && regras.tabelaCategoria?.faixas && !regras.tabelaCategoria.usar_valor_fixo_pacote) {
        const faixa = encontrarFaixaPreco(qtdParaFaixa, regras.tabelaCategoria.faixas);
        if (faixa?.valor) displayUnitPrice = normalizarValor(faixa.valor);
      } else {
        // Fixed pricing model
        const valorPacote = regrasCongeladas.pacote?.valorFotoExtra;
        if (valorPacote && valorPacote > 0) displayUnitPrice = normalizarValor(valorPacote);
      }
    }
    
    return {
      valorUnitario: displayUnitPrice,  // Show actual average price or tier price
      valorACobrar: 0,
      valorTotalIdeal: valorJaPago,
      economia: 0,
      totalExtras: extrasPagasTotal,
      modeloUsado: 'fixo',
    };
  }
  
  // Find the tier based on TOTAL accumulated extras (not just new ones)
  let valorUnitario = fallbackNormalizado;
  let faixaAtual: FaixaPreco | null = null;
  let modeloUsado: 'fixo' | 'global' | 'categoria' = 'fixo';
  
  // Get base price for savings calculation
  const valorPacoteRaw = regrasCongeladas?.pacote?.valorFotoExtra || valorFotoExtraFixo;
  const precoBasePacote = normalizarValor(valorPacoteRaw);
  
  if (regrasCongeladas?.precificacaoFotoExtra) {
    const regras = regrasCongeladas.precificacaoFotoExtra;
    
    switch (regras.modelo) {
      case 'fixo':
        valorUnitario = precoBasePacote;
        modeloUsado = 'fixo';
        break;
        
      case 'global':
        if (regras.tabelaGlobal?.faixas) {
          faixaAtual = encontrarFaixaPreco(totalExtras, regras.tabelaGlobal.faixas);
          valorUnitario = faixaAtual?.valor ? normalizarValor(faixaAtual.valor) : precoBasePacote;
          modeloUsado = 'global';
        } else {
          valorUnitario = precoBasePacote;
        }
        break;
        
      case 'categoria':
        if (regras.tabelaCategoria?.usar_valor_fixo_pacote) {
          valorUnitario = precoBasePacote;
          modeloUsado = 'fixo';
        } else if (regras.tabelaCategoria?.faixas) {
          faixaAtual = encontrarFaixaPreco(totalExtras, regras.tabelaCategoria.faixas);
          valorUnitario = faixaAtual?.valor ? normalizarValor(faixaAtual.valor) : precoBasePacote;
          modeloUsado = 'categoria';
        } else {
          valorUnitario = precoBasePacote;
        }
        break;
        
      default:
        valorUnitario = fallbackNormalizado;
    }
  }
  
  // Ensure we have a valid price
  if (!valorUnitario || valorUnitario <= 0) {
    valorUnitario = fallbackNormalizado;
  }
  
  // Calculate what the total WOULD cost if bought all at once
  const valorTotalIdeal = totalExtras * valorUnitario;
  
  // Subtract what was already paid (credit system)
  // This ensures client pays same total regardless of number of selection cycles
  const valorACobrar = Math.max(0, valorTotalIdeal - valorJaPago);
  
  // Calculate savings compared to base price (first tier)
  const valorSemDesconto = totalExtras * precoBasePacote;
  const economia = Math.max(0, valorSemDesconto - valorTotalIdeal);
  
  return {
    valorUnitario,
    valorACobrar,
    valorTotalIdeal,
    economia,
    totalExtras,
    faixaAtual: faixaAtual || undefined,
    modeloUsado,
  };
}

/**
 * Gets the pricing model display name in Portuguese
 */
export function getModeloDisplayName(modelo: string): string {
  switch (modelo) {
    case 'fixo':
      return 'Preço Fixo';
    case 'global':
      return 'Tabela Global';
    case 'categoria':
      return 'Tabela por Categoria';
    default:
      return 'Padrão';
  }
}

/**
 * Formats a price tier for display
 */
export function formatFaixaDisplay(faixa: FaixaPreco): string {
  if (faixa.max === null) {
    return `${faixa.min}+ fotos`;
  }
  if (faixa.min === faixa.max) {
    return `${faixa.min} foto${faixa.min > 1 ? 's' : ''}`;
  }
  return `${faixa.min}-${faixa.max} fotos`;
}

/**
 * Gets all available tiers from the frozen rules
 */
export function getFaixasFromRegras(regras: RegrasCongeladas | null | undefined): FaixaPreco[] {
  if (!regras?.precificacaoFotoExtra) return [];
  
  const precificacao = regras.precificacaoFotoExtra;
  
  if (precificacao.modelo === 'global' && precificacao.tabelaGlobal?.faixas) {
    return precificacao.tabelaGlobal.faixas;
  }
  
  if (precificacao.modelo === 'categoria' && precificacao.tabelaCategoria?.faixas) {
    return precificacao.tabelaCategoria.faixas;
  }
  
  return [];
}
