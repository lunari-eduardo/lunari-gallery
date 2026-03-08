/**
 * Cálculo de antecipação de recebíveis para cartão de crédito (Asaas).
 *
 * A taxa é **mensal** e se acumula proporcionalmente ao número da parcela.
 * Para a parcela i (1-indexed), a taxa total = taxaMensal × i.
 */

export interface AnticipationDetail {
  parcela: number;
  meses: number;
  taxa: number;       // percentual total aplicado (ex: 2.50)
  valorBruto: number; // valor da parcela antes da antecipação
  liquido: number;    // valor líquido após desconto
}

export interface AnticipationResult {
  valorLiquido: number;
  totalTaxa: number;
  detalheParcelas: AnticipationDetail[];
}

/**
 * Calcula o valor líquido após antecipação de recebíveis.
 *
 * @param valorTotal  Valor total da venda
 * @param parcelas    Número de parcelas (1 = à vista)
 * @param taxaMensal  Taxa mensal em percentual (ex: 1.25 para 1.25%)
 */
export function calcularAntecipacao(
  valorTotal: number,
  parcelas: number,
  taxaMensal: number,
): AnticipationResult {
  if (parcelas <= 0 || valorTotal <= 0 || taxaMensal <= 0) {
    return {
      valorLiquido: valorTotal,
      totalTaxa: 0,
      detalheParcelas: [],
    };
  }

  const valorParcela = valorTotal / parcelas;
  const detalheParcelas: AnticipationDetail[] = [];
  let valorLiquido = 0;

  for (let i = 1; i <= parcelas; i++) {
    const taxaTotal = taxaMensal * i;
    const liquido = valorParcela * (1 - taxaTotal / 100);
    detalheParcelas.push({
      parcela: i,
      meses: i,
      taxa: Math.round(taxaTotal * 100) / 100,
      valorBruto: Math.round(valorParcela * 100) / 100,
      liquido: Math.round(liquido * 100) / 100,
    });
    valorLiquido += liquido;
  }

  valorLiquido = Math.round(valorLiquido * 100) / 100;
  const totalTaxa = Math.round((valorTotal - valorLiquido) * 100) / 100;

  return { valorLiquido, totalTaxa, detalheParcelas };
}

/**
 * Calcula o valor a cobrar do cliente para que o fotógrafo receba
 * exatamente `valorDesejado` após antecipação.
 *
 * valorCobrado = valorDesejado + custoAntecipacao(valorDesejado)
 */
export function calcularValorComAntecipacao(
  valorDesejado: number,
  parcelas: number,
  taxaMensal: number,
): number {
  if (parcelas <= 0 || valorDesejado <= 0 || taxaMensal <= 0) {
    return valorDesejado;
  }

  const { totalTaxa } = calcularAntecipacao(valorDesejado, parcelas, taxaMensal);
  return Math.round((valorDesejado + totalTaxa) * 100) / 100;
}
