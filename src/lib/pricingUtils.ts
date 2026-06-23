/**
 * Progressive Pricing Utilities
 * Handles discount tiers for extra photos based on frozen rules from Gestão.
 *
 * ⚠️ CONTRATO CRÍTICO — leia antes de mexer aqui ou no projeto Gestão:
 *
 * `regras_congeladas` é a fonte ÚNICA de verdade para descontos progressivos.
 * Em galerias vinculadas ao Studio, esta coluna pode estar populada APENAS em
 * `clientes_sessoes` (não em `galerias`). Para garantir consistência existem:
 *
 *   1. Trigger DB `sync_galeria_regras_from_session` (BEFORE INSERT/UPDATE em
 *      galerias) — copia da sessão quando a galeria não tem regras próprias E
 *      `regras_override = false`.
 *   2. Trigger DB `propagate_session_regras_to_galerias` (AFTER UPDATE em
 *      clientes_sessoes) — propaga mudanças para galerias vinculadas APENAS
 *      quando `regras_override = false`.
 *
 * OVERRIDE POR GALERIA (`galerias.regras_override`):
 *   - GalleryEdit permite editar fotos_incluidas, valor_foto_extra e a tabela
 *     progressiva mesmo em galerias vinculadas. Ao salvar com mudanças, o flag
 *     `regras_override` vai para true e a galeria deixa de receber propagação
 *     da sessão. Botão "Restaurar regras da sessão" volta override = false e
 *     limpa `regras_congeladas` (o trigger re-popula).
 *
 * Surfaces que CONSOMEM regras_congeladas (todos confiam na coluna da galeria):
 *   - supabase/functions/gallery-access/index.ts        (cliente)
 *   - supabase/functions/confirm-selection/index.ts     (já tem fallback)
 *   - src/hooks/useSupabaseGalleries.ts                 (painel fotógrafo)
 *   - src/pages/ClientGallery.tsx                       (seleção)
 *   - src/pages/GalleryDetail.tsx                       (admin)
 *
 * Se os triggers forem removidos ou a coluna mudar de lugar, TODOS estes
 * surfaces precisam ganhar fallback explícito buscando da sessão.
 */

import { DiscountPackage } from '@/types/gallery';

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
 * Sanitizes an extra-photo unit price coming from any source (Gestão params,
 * frozen rules, manual UI input, etc).
 *
 * Behavior:
 * - Coerces to number; invalid/negative values become 0;
 * - Clamps to a maximum of R$ 999,99 (any value above is considered an
 *   upstream bug and gets clamped + logged) — this prevents incidents like
 *   "R$ 250,05" or "R$ 2.500,50" from propagating into galleries;
 * - Returns the value rounded to 2 decimal places.
 *
 * IMPORTANT: this function does NOT convert cents to reals. Gestão already
 * stores prices in reals; if a future migration ever stores in cents it MUST
 * be handled explicitly at the source, not via heuristics here.
 */
export function sanitizeExtraPrice(value: unknown): number {
  const v = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  if (!isFinite(v) || v < 0) return 0;
  if (v > 999.99) {
    console.warn('[sanitizeExtraPrice] valor acima do limite esperado (clamped to 999.99):', v);
    return 999.99;
  }
  return Math.round(v * 100) / 100;
}

/**
 * @deprecated Use `sanitizeExtraPrice` instead. Kept as a thin alias for
 * backward compatibility with existing call sites. The old "if value > 1000
 * divide by 100" heuristic was unreliable (it failed for the R$ 250,05 bug
 * and would corrupt legitimate premium packages above R$ 1.000) and has been
 * removed.
 */
export function normalizarValor(valor: number, _forceSkip = false): number {
  return sanitizeExtraPrice(valor);
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
  // Resolve base price with "JSON wins" rule:
  // The session's `regras_congeladas.pacote.valorFotoExtra` is the single
  // source of truth (1 sessão = 1 galeria). The scalar `valorFotoExtraFixo`
  // is only used as a fallback for legacy/standalone galleries that have no
  // frozen rules JSON.
  const fixoSanitizado = sanitizeExtraPrice(valorFotoExtraFixo);
  const regrasSanitizado = sanitizeExtraPrice(regrasCongeladas.pacote?.valorFotoExtra ?? 0);
  const precoBasePacote = regrasSanitizado > 0 ? regrasSanitizado : fixoSanitizado;

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
        valorUnitario = faixaAtual?.valor ? sanitizeExtraPrice(faixaAtual.valor) : precoBasePacote;
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
        valorUnitario = faixaAtual?.valor ? sanitizeExtraPrice(faixaAtual.valor) : precoBasePacote;
        modeloUsado = 'categoria';
      } else {
        valorUnitario = precoBasePacote;
      }
      break;
      
    default:
      valorUnitario = sanitizeExtraPrice(valorFotoExtraFixo);
  }

  // Ensure we have a valid price
  if (!valorUnitario || valorUnitario <= 0) {
    valorUnitario = sanitizeExtraPrice(valorFotoExtraFixo) || precoBasePacote;
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
        // Fixed pricing model — JSON wins over scalar fallback
        const valorPacote = sanitizeExtraPrice(regrasCongeladas.pacote?.valorFotoExtra ?? 0);
        const fixoNorm = sanitizeExtraPrice(valorFotoExtraFixo);
        if (valorPacote > 0) displayUnitPrice = valorPacote;
        else if (fixoNorm > 0) displayUnitPrice = fixoNorm;
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
  
  // Resolve base price with "JSON wins" rule (see calcularPrecoProgressivo).
  // The session's frozen JSON is the single source of truth.
  const fixoSanitizado = sanitizeExtraPrice(valorFotoExtraFixo);
  const regrasSanitizado = sanitizeExtraPrice(regrasCongeladas?.pacote?.valorFotoExtra ?? 0);
  const precoBasePacote = regrasSanitizado > 0 ? regrasSanitizado : fixoSanitizado;
  
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

/**
 * Builds RegrasCongeladas from standalone discount packages
 * Used when photographer configures progressive pricing without Gestão integration
 * 
 * This function transforms the UI-friendly DiscountPackage[] format into the
 * standard RegrasCongeladas format used by the pricing engine.
 * 
 * @param discountPackages - Array of discount packages from the UI
 * @param fixedPrice - Base price per extra photo (used for savings calculation)
 * @param includedPhotos - Number of photos included in the package
 * @param packageName - Optional package name for display
 * @returns RegrasCongeladas object ready to be saved to the database
 */
export function buildRegrasFromDiscountPackages(
  discountPackages: DiscountPackage[],
  fixedPrice: number,
  includedPhotos: number,
  packageName?: string
): RegrasCongeladas {
  // If no packages or using fixed pricing, return simple fixed rules
  if (!discountPackages || discountPackages.length === 0) {
    return {
      modelo: 'fixo',
      dataCongelamento: new Date().toISOString(),
      pacote: {
        nome: packageName || 'Pacote Manual',
        fotosIncluidas: includedPhotos,
        valorFotoExtra: fixedPrice,
      },
      precificacaoFotoExtra: {
        modelo: 'fixo',
        valorFixo: fixedPrice,
      },
    };
  }

  // Transform discountPackages to faixas format
  const faixas: FaixaPreco[] = discountPackages.map(pkg => ({
    min: pkg.minPhotos,
    max: pkg.maxPhotos, // Already null for infinity
    valor: pkg.pricePerPhoto,
  }));

  return {
    modelo: 'global', // Use global model for standalone packages
    dataCongelamento: new Date().toISOString(),
    pacote: {
      nome: packageName || 'Pacote Manual',
      fotosIncluidas: includedPhotos,
      valorFotoExtra: fixedPrice, // Base price for savings calculation
    },
    precificacaoFotoExtra: {
      modelo: 'global',
      tabelaGlobal: {
        faixas,
      },
    },
  };
}

/**
 * Inverso de `buildRegrasFromDiscountPackages`: extrai a tabela de faixas
 * (DiscountPackage[]) a partir de um `RegrasCongeladas` salvo. Usado pelo
 * GalleryEdit para hidratar o editor de faixas a partir do JSONB existente.
 *
 * Retorna [] quando o modelo é fixo ou não há faixas definidas.
 */
export function discountPackagesFromRegras(
  regras: RegrasCongeladas | null | undefined,
): DiscountPackage[] {
  const faixas = getFaixasFromRegras(regras);
  if (!faixas.length) return [];
  return [...faixas]
    .sort((a, b) => a.min - b.min)
    .map((f, idx) => ({
      id: `faixa-${idx}-${f.min}`,
      minPhotos: f.min,
      maxPhotos: f.max,
      pricePerPhoto: sanitizeExtraPrice(f.valor),
    }));
}

