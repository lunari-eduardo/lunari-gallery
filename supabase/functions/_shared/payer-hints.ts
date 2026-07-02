/**
 * Resolve dados do pagador para pré-preencher checkouts (InfinitePay, Asaas, MP)
 * e viabilizar antecipação de recebíveis no Asaas (requer CPF/CNPJ + telefone).
 *
 * Ordem de prioridade:
 *   1) clientes (via cliente_id)         → nome, email, telefone/whatsapp, cpf_cnpj, endereço
 *   2) galeria_visitantes (via visitor_id) → nome + contato (fallback)
 *
 * Regras:
 *   - "firstName" = apenas primeiro nome (split por espaço).
 *   - "email" validado por regex; se inválido → undefined.
 *   - "phone" normalizado (só dígitos); phoneParts para MP (area_code + number).
 *   - "cpfCnpj" só dígitos, 11 (CPF) ou 14 (CNPJ), senão undefined.
 *   - Endereço só é devolvido quando existe algum campo preenchido.
 *
 * NÃO grava nada. Somente leitura.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface PayerAddress {
  postalCode?: string;   // só dígitos, 8
  street?: string;
  number?: string;
  complement?: string;
  province?: string;     // bairro
  city?: string;
  state?: string;        // UF (2 letras)
}

export interface PayerHints {
  firstName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  phoneParts?: { area_code: string; number: string };
  cpfCnpj?: string;
  address?: PayerAddress;
}

function firstNameOf(full?: string | null): string | undefined {
  if (!full) return undefined;
  const p = full.trim().split(/\s+/)[0];
  return p && p.length > 0 ? p : undefined;
}

function normalizeEmail(email?: string | null): string | undefined {
  if (!email) return undefined;
  const clean = email.trim().toLowerCase();
  return EMAIL_RE.test(clean) ? clean : undefined;
}

function normalizePhone(raw?: string | null): { phone?: string; phoneParts?: PayerHints['phoneParts'] } {
  if (!raw) return {};
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13) return {};
  const local = digits.length >= 12 && digits.startsWith('55') ? digits.slice(2) : digits;
  if (local.length !== 10 && local.length !== 11) return { phone: digits };
  return {
    phone: local,
    phoneParts: { area_code: local.slice(0, 2), number: local.slice(2) },
  };
}

function normalizeCpfCnpj(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const digits = String(raw).replace(/\D/g, '');
  return digits.length === 11 || digits.length === 14 ? digits : undefined;
}

function normalizeCep(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const digits = String(raw).replace(/\D/g, '');
  return digits.length === 8 ? digits : undefined;
}

function buildAddress(row: Record<string, unknown>): PayerAddress | undefined {
  const cep = normalizeCep(row.cep as string | null);
  const street = (row.endereco as string | null)?.trim() || undefined;
  const number = (row.endereco_numero as string | null)?.trim() || undefined;
  const complement = (row.endereco_complemento as string | null)?.trim() || undefined;
  const province = (row.bairro as string | null)?.trim() || undefined;
  const city = (row.cidade as string | null)?.trim() || undefined;
  const uf = (row.uf as string | null)?.trim().toUpperCase();
  const state = uf && /^[A-Z]{2}$/.test(uf) ? uf : undefined;

  if (!cep && !street && !number && !complement && !province && !city && !state) return undefined;
  return { postalCode: cep, street, number, complement, province, city, state };
}

export async function resolvePayerHints(
  supabase: any,
  opts: { clienteId?: string | null; visitorId?: string | null },
): Promise<PayerHints> {
  const hints: PayerHints = {};

  if (opts.clienteId) {
    const { data: c } = await supabase
      .from('clientes')
      .select('nome, email, telefone, whatsapp, cpf_cnpj, cep, endereco, endereco_numero, endereco_complemento, bairro, cidade, uf')
      .eq('id', opts.clienteId)
      .maybeSingle();
    if (c) {
      hints.firstName = firstNameOf(c.nome);
      hints.fullName = c.nome?.trim() || undefined;
      hints.email = normalizeEmail(c.email);
      const p = normalizePhone(c.telefone || c.whatsapp);
      hints.phone = p.phone;
      hints.phoneParts = p.phoneParts;
      hints.cpfCnpj = normalizeCpfCnpj(c.cpf_cnpj);
      hints.address = buildAddress(c);
    }
  }

  if ((!hints.firstName || !hints.email || !hints.phone || !hints.cpfCnpj) && opts.visitorId) {
    const { data: v } = await supabase
      .from('galeria_visitantes')
      .select('nome, contato, contato_tipo, cpf_cnpj')
      .eq('id', opts.visitorId)
      .maybeSingle();
    if (v) {
      if (!hints.firstName) hints.firstName = firstNameOf(v.nome);
      if (!hints.fullName) hints.fullName = v.nome?.trim() || undefined;
      if (v.contato_tipo === 'email' && !hints.email) {
        hints.email = normalizeEmail(v.contato);
      } else if (v.contato_tipo === 'telefone' && !hints.phone) {
        const p = normalizePhone(v.contato);
        hints.phone = p.phone;
        hints.phoneParts = p.phoneParts;
      }
      if (!hints.cpfCnpj) hints.cpfCnpj = normalizeCpfCnpj(v.cpf_cnpj);
    }
  }

  return hints;
}

/**
 * Log seguro dos hints (apenas booleans — nunca valores).
 */
export function payerHintsFlags(h: PayerHints): string {
  const addr = h.address
    ? `Y(cep=${h.address.postalCode ? 'Y' : 'N'} num=${h.address.number ? 'Y' : 'N'} city=${h.address.city ? 'Y' : 'N'})`
    : 'N';
  return `name=${h.firstName ? 'Y' : 'N'} email=${h.email ? 'Y' : 'N'} phone=${h.phone ? 'Y' : 'N'} cpf=${h.cpfCnpj ? 'Y' : 'N'} addr=${addr}`;
}

/**
 * Indica se o customer tem tudo para uma cobrança ser antecipável no Asaas.
 * PIX/Boleto exige nome + cpfCnpj + telefone. Cartão exige nome + cpfCnpj.
 */
export function isAnticipationEligible(h: PayerHints, billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO'): boolean {
  if (!h.firstName || !h.cpfCnpj) return false;
  if (billingType !== 'CREDIT_CARD' && !h.phone) return false;
  return true;
}
