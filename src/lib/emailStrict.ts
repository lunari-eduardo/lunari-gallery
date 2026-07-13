/**
 * Validação estrita de e-mail, alinhada ao regex ASCII usado pelo backend
 * (`supabase/functions/_shared/payer-hints.ts`). Rejeita acentos e caracteres
 * não-ASCII para evitar que o front aceite algo que o Asaas depois recusa.
 */

export type EmailErrorCode = 'EMPTY' | 'NON_ASCII' | 'INVALID_FORMAT' | 'NO_TLD';

export const EMAIL_ERROR_MESSAGES: Record<EmailErrorCode, string> = {
  EMPTY: 'Informe seu e-mail.',
  NON_ASCII: 'Use apenas letras sem acento no e-mail.',
  INVALID_FORMAT: 'E-mail inválido. Exemplo: nome@dominio.com',
  NO_TLD: 'E-mail incompleto. Falta o domínio, ex.: nome@dominio.com',
};

// Mesmo regex do payer-hints.ts (ASCII-only) — Asaas rejeita não-ASCII.
const EMAIL_RE = /^[\x21-\x7E]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const NON_ASCII_RE = /[^\x00-\x7F]/;

export interface EmailValidationOk { ok: true; value: string }
export interface EmailValidationErr { ok: false; code: EmailErrorCode; message: string }
export type EmailValidationResult = EmailValidationOk | EmailValidationErr;

export function validateEmailStrict(raw: string): EmailValidationResult {
  const trimmed = (raw || '').trim();
  if (!trimmed) return { ok: false, code: 'EMPTY', message: EMAIL_ERROR_MESSAGES.EMPTY };

  const clean = trimmed.toLowerCase();
  if (NON_ASCII_RE.test(clean)) {
    return { ok: false, code: 'NON_ASCII', message: EMAIL_ERROR_MESSAGES.NON_ASCII };
  }
  if (!clean.includes('@')) {
    return { ok: false, code: 'INVALID_FORMAT', message: EMAIL_ERROR_MESSAGES.INVALID_FORMAT };
  }
  const [, domain = ''] = clean.split('@');
  if (!domain.includes('.')) {
    return { ok: false, code: 'NO_TLD', message: EMAIL_ERROR_MESSAGES.NO_TLD };
  }
  if (!EMAIL_RE.test(clean) || clean.length > 160) {
    return { ok: false, code: 'INVALID_FORMAT', message: EMAIL_ERROR_MESSAGES.INVALID_FORMAT };
  }
  return { ok: true, value: clean };
}
