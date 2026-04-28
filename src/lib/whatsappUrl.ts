/**
 * Normaliza um telefone brasileiro e constrói uma URL wa.me.
 *
 * Regras de normalização:
 * - Remove tudo que não for dígito.
 * - Se tiver 12 ou 13 dígitos e começar com '55' → já está com DDI, usa como está.
 * - Se tiver 10 ou 11 dígitos → BR sem DDI, prefixa '55'.
 * - Qualquer outro caso → retorna null (formato inesperado).
 */
export function normalizeBrPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;

  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    return digits;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return null;
}

/**
 * Constrói a URL do WhatsApp para a conversa direta quando possível.
 * Retorna { url, hasDirectContact }:
 *  - hasDirectContact=true → abre a conversa do cliente direto.
 *  - hasDirectContact=false → abre o seletor de contatos (fallback wa.me/?text=...).
 */
export function buildWhatsAppUrl(
  phone: string | null | undefined,
  message: string,
): { url: string; hasDirectContact: boolean } {
  const normalized = normalizeBrPhone(phone);
  const encoded = encodeURIComponent(message);
  if (normalized) {
    return { url: `https://wa.me/${normalized}?text=${encoded}`, hasDirectContact: true };
  }
  return { url: `https://wa.me/?text=${encoded}`, hasDirectContact: false };
}
