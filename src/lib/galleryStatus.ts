import { GalleryStatus, SelectionStatus } from '@/types/gallery';

/**
 * Deriva o status efetivo da galeria com base em múltiplos campos para evitar dessincronias na UI.
 * Prioriza finalized_at e status_pagamento sobre o campo status bruto.
 */
export function getEffectiveGalleryStatus(
  status: string,
  statusPagamento?: string,
  finalizedAt?: Date | string | null,
  statusSelecao?: string
): 'created' | 'sent' | 'selection_started' | 'selection_completed' | 'expired' | 'cancelled' {
  
  // Se já foi finalizada ou paga, o status efetivo é sempre concluída
  if (finalizedAt || statusPagamento === 'pago' || statusPagamento === 'pago_manual' || statusSelecao === 'selecao_completa') {
    return 'selection_completed';
  }

  const statusMap: Record<string, 'created' | 'sent' | 'selection_started' | 'selection_completed' | 'expired' | 'cancelled'> = {
    'rascunho': 'created',
    'created': 'created',
    'enviado': 'sent',
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

  return statusMap[status] || 'created';
}
