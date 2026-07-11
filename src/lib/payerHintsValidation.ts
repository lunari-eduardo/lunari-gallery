/**
 * Valida se os `payerHints` retornados pelo `gallery-access` estão completos
 * e válidos o suficiente para pular a etapa intermediária de coleta de dados
 * (`PreCheckoutContactStep`) antes do checkout.
 *
 * Reutiliza os mesmos schemas de validação usados na tela de coleta.
 */
import { isValidCpfCnpj, onlyDigits } from '@/lib/validateCpfCnpj';

export interface PayerHintsShape {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  cpfCnpj?: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * True quando todos os 4 dados existem e são válidos.
 * - nome ≥ 3 chars
 * - email formato válido
 * - telefone com 10–13 dígitos
 * - CPF/CNPJ com dígito verificador OK
 */
export function hintsAreComplete(h?: PayerHintsShape | null): boolean {
  if (!h) return false;
  const name = (h.fullName || '').trim();
  const email = (h.email || '').trim();
  const phoneDigits = onlyDigits(h.phone || '');
  const cpfDigits = onlyDigits(h.cpfCnpj || '');
  return (
    name.length >= 3 &&
    EMAIL_RE.test(email) &&
    phoneDigits.length >= 10 &&
    phoneDigits.length <= 13 &&
    isValidCpfCnpj(cpfDigits)
  );
}
