// supabase/functions/_shared/pricing.ts

import { RegrasCongeladas } from './types.ts';

function normalizarValor(valor: number): number {
  if (valor > 1000) {
    return valor / 100;
  }
  return valor;
}

export function calcularPrecoProgressivoComCredito(
  extrasNovas: number,           // Novas fotos selecionadas neste ciclo
  extrasPagasTotal: number,       // Fotos já pagas anteriormente (quantidade)
  valorJaPago: number,            // Valor total já pago por extras (R$)
  regrasCongeladas: RegrasCongeladas | null | undefined,
  valorFotoExtraFixo: number
): { valorUnitario: number; valorACobrar: number; valorTotalIdeal: number; totalExtras: number } {
  
  const totalExtras = extrasPagasTotal + extrasNovas;
  const fallbackValue = normalizarValor(valorFotoExtraFixo);
  
  if (extrasNovas <= 0 || totalExtras <= 0) {
    return {
      valorUnitario: 0,
      valorACobrar: 0,
      valorTotalIdeal: valorJaPago,
      totalExtras: extrasPagasTotal,
    };
  }

  const valorPacoteRaw = regrasCongeladas?.pacote?.valorFotoExtra || valorFotoExtraFixo;
  const precoBasePacote = normalizarValor(valorPacoteRaw);

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

  if (modelo === 'fixo') {
    valorUnitario = normalizarValor(
      precificacao?.valorFixo ||
        regrasCongeladas.pacote?.valorFotoExtra ||
        valorFotoExtraFixo
    );
  } else {
    let tabela = (modelo === 'categoria' ? precificacao?.tabelaCategoria : precificacao?.tabelaGlobal);

    if (tabela && tabela.faixas && tabela.faixas.length > 0) {
      const faixaAtual = tabela.faixas.find((faixa) => {
        return totalExtras >= faixa.min && (faixa.max === null || totalExtras <= faixa.max);
      });

      if (faixaAtual) {
        valorUnitario = normalizarValor(faixaAtual.valor);
      } else {
        const faixasOrdenadas = [...tabela.faixas].sort((a, b) => b.min - a.min);
        if (faixasOrdenadas.length > 0) {
          valorUnitario = normalizarValor(faixasOrdenadas[0].valor);
        }
      }
    }
  }

  if (!valorUnitario || valorUnitario <= 0) {
    valorUnitario = fallbackValue;
  }

  const valorTotalIdeal = totalExtras * valorUnitario;
  const valorACobrar = Math.max(0, valorTotalIdeal - valorJaPago);

  return {
    valorUnitario,
    valorACobrar,
    valorTotalIdeal,
    totalExtras,
  };
}
