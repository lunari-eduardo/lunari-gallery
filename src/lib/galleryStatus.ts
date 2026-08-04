import { GalleryStatus, SelectionStatus } from '@/types/gallery';

/**
 * Deriva o status efetivo da galeria com base em múltiplos campos para evitar dessincronias na UI.
 * Prioriza finalized_at e status_pagamento sobre o campo status bruto.
 */
export function getEffectiveGalleryStatus(
  status: string | null | undefined,
  statusPagamento?: string | null,
  finalizedAt?: Date | string | null,
  statusSelecao?: string | null,
  prazoSelecao?: Date | string | null
): 'created' | 'sent' | 'selection_started' | 'selection_completed' | 'expired' | 'cancelled' {
  
  // Normalização inicial do status bruto (Português/Inglês)
  const normalizedRawStatus = (status || '').toLowerCase();

  // Se já foi finalizada ou paga, o status efetivo é sempre concluída
  if (finalizedAt || statusPagamento === 'pago' || statusPagamento === 'pago_manual' || statusSelecao === 'selecao_completa') {
    return 'selection_completed';
  }

  // Se o prazo expirou e a galeria está em um estado ativo, ela é considerada expirada
  const isPastDeadline = prazoSelecao && new Date(prazoSelecao).getTime() < Date.now();
  const isActiveStatus = [
    'enviado', 'sent', 
    'em_selecao', 'selection_started', 'selecao_iniciada',
    'publicada'
  ].includes(normalizedRawStatus);
  
  if (isPastDeadline && isActiveStatus) {
    return 'expired';
  }

  const statusMap: Record<string, 'created' | 'sent' | 'selection_started' | 'selection_completed' | 'expired' | 'cancelled'> = {
    'rascunho': 'created',
    'criado': 'created',
    'created': 'created',
    'enviado': 'sent',
    'publicada': 'sent',
    'sent': 'sent',
    'em_selecao': 'selection_started',
    'selection_started': 'selection_started',
    'selecao_iniciada': 'selection_started',
    'confirmada': 'selection_completed',
    'selection_completed': 'selection_completed',
    'selecao_completa': 'selection_completed',
    'expirada': 'expired',
    'expired': 'expired',
    'expirado': 'expired',
    'cancelada': 'cancelled',
    'cancelled': 'cancelled',
  };

  return statusMap[normalizedRawStatus] || 'created';
}

const PAYMENT_PROVIDER_LABELS: Record<string, string> = {
  pix_manual: 'PIX Manual',
  infinitepay: 'InfinitePay',
  mercadopago: 'Mercado Pago',
  asaas: 'Asaas',
};

/**
 * Rótulo do modo de cobrança da galeria, incluindo o provedor ativo.
 * Precedência: colunas `venda_*` vencem sobre o JSON `configuracoes.saleSettings`.
 */
export function getBillingModeLabel(params: {
  vendaModo?: string | null;
  vendaPagamentoProvedor?: string | null;
  saleSettings?: { mode?: string; paymentMethod?: string } | null;
}): { label: string; missingProvider: boolean } {
  const mode = params.vendaModo || params.saleSettings?.mode || 'sale_without_payment';

  if (mode === 'no_sale') return { label: 'Sem cobrança', missingProvider: false };
  if (mode !== 'sale_with_payment') return { label: 'Cobrança posterior', missingProvider: false };

  const provider = params.vendaPagamentoProvedor || params.saleSettings?.paymentMethod || '';
  const providerLabel = PAYMENT_PROVIDER_LABELS[provider];

  return providerLabel
    ? { label: `Pagamento online · ${providerLabel}`, missingProvider: false }
    : { label: 'Pagamento online · Nenhum', missingProvider: true };
}
