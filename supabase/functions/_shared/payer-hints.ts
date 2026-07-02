/**
 * Resolve dados do pagador para pré-preencher checkouts (InfinitePay, Asaas, MP).
 *
 * Ordem de prioridade:
 *   1) clientes (via cliente_id da cobrança/galeria)     → nome + email + telefone/whatsapp
 *   2) galeria_visitantes (via visitor_id)               → nome + contato + contato_tipo
 *
 * Regras:
 *   - "nome" = apenas primeiro nome (split por espaço).
 *   - "email" = validado por regex; se inválido → undefined.
 *   - "telefone" = normalizado para dígitos; se 10-11 dígitos, quebrado em area_code (2) + number.
 *
 * NÃO grava nada. Somente leitura.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface PayerHints {
  firstName?: string;
  email?: string;
  phone?: string;               // ex: "11987654321" (só dígitos)
  phoneParts?: { area_code: string; number: string };
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
  // Se vier com 12 ou 13 dígitos (DDI 55), remove DDI Brasil
  const local = digits.length >= 12 && digits.startsWith('55') ? digits.slice(2) : digits;
  if (local.length !== 10 && local.length !== 11) return { phone: digits };
  return {
    phone: local,
    phoneParts: { area_code: local.slice(0, 2), number: local.slice(2) },
  };
}

/**
 * Resolve os hints a partir do banco. Passe supabase (service role client).
 */
export async function resolvePayerHints(
  supabase: any,
  opts: { clienteId?: string | null; visitorId?: string | null },
): Promise<PayerHints> {
  const hints: PayerHints = {};

  // 1) cliente
  if (opts.clienteId) {
    const { data: c } = await supabase
      .from('clientes')
      .select('nome, email, telefone, whatsapp')
      .eq('id', opts.clienteId)
      .maybeSingle();
    if (c) {
      hints.firstName = firstNameOf(c.nome);
      hints.email = normalizeEmail(c.email);
      const p = normalizePhone(c.telefone || c.whatsapp);
      hints.phone = p.phone;
      hints.phoneParts = p.phoneParts;
    }
  }

  // 2) fallback: visitor (para galerias públicas)
  if ((!hints.firstName || !hints.email || !hints.phone) && opts.visitorId) {
    const { data: v } = await supabase
      .from('galeria_visitantes')
      .select('nome, contato, contato_tipo')
      .eq('id', opts.visitorId)
      .maybeSingle();
    if (v) {
      if (!hints.firstName) hints.firstName = firstNameOf(v.nome);
      if (v.contato_tipo === 'email' && !hints.email) {
        hints.email = normalizeEmail(v.contato);
      } else if (v.contato_tipo === 'telefone' && !hints.phone) {
        const p = normalizePhone(v.contato);
        hints.phone = p.phone;
        hints.phoneParts = p.phoneParts;
      }
    }
  }

  return hints;
}

/**
 * Log seguro dos hints (apenas booleans — nunca valores).
 */
export function payerHintsFlags(h: PayerHints): string {
  return `name=${h.firstName ? 'Y' : 'N'} email=${h.email ? 'Y' : 'N'} phone=${h.phone ? 'Y' : 'N'}`;
}
