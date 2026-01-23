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
 */
export function normalizarValor(valor: number): number {
  if (valor > 1000) {
    return valor / 100;
  }
  return valor;
}

/**
 * Finds the price tier for the given quantity
 */
function encontrarFaixaPreco(quantidade: number, faixas: FaixaPreco[]): FaixaPreco | null {
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
export function calcularPrecoProgressivo(
  quantidadeFotosExtras: number,
  regrasCongeladas: RegrasCongeladas | null | undefined,
  valorFotoExtraFixo: number
): CalculoPrecoResult {
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
        faixaAtual = encontrarFaixaPreco(quantidadeFotosExtras, regras.tabelaGlobal.faixas);
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
        faixaAtual = encontrarFaixaPreco(quantidadeFotosExtras, regras.tabelaCategoria.faixas);
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
