/**
 * Validação estrita de telefone brasileiro para o pré-checkout.
 *
 * Detecta e explica os erros mais comuns cometidos pelo cliente:
 *  - Código do país duplicado (ex.: "5555119..." ou "+55 +55")
 *  - DDD ausente (só 8 ou 9 dígitos digitados)
 *  - DDD inexistente (ex.: 01, 20, 23, 26, etc.)
 *  - Celular sem o 9º dígito
 *  - Muito curto / muito longo
 *
 * Retorna sempre `local` com 10 (fixo) ou 11 (celular) dígitos sem código país
 * — é esse valor que os provedores (Asaas/MP/InfinitePay) aceitam.
 */

export type PhoneErrorCode =
  | 'EMPTY'
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'DUPLICATED_COUNTRY_CODE'
  | 'MISSING_DDD'
  | 'INVALID_DDD'
  | 'MISSING_NINTH_DIGIT'
  | 'INVALID_LOCAL';

/** DDDs válidos no plano de numeração brasileiro (ANATEL). */
const VALID_DDDS = new Set<string>([
  '11','12','13','14','15','16','17','18','19',
  '21','22','24','27','28',
  '31','32','33','34','35','37','38',
  '41','42','43','44','45','46','47','48','49',
  '51','53','54','55',
  '61','62','63','64','65','66','67','68','69',
  '71','73','74','75','77','79',
  '81','82','83','84','85','86','87','88','89',
  '91','92','93','94','95','96','97','98','99',
]);

export const PHONE_ERROR_MESSAGES: Record<PhoneErrorCode, string> = {
  EMPTY: 'Informe seu WhatsApp com DDD.',
  TOO_SHORT: 'Número incompleto. Digite DDD + número, ex.: (11) 98765-4321.',
  TOO_LONG: 'Número com dígitos a mais. Confira e digite apenas DDD + número.',
  DUPLICATED_COUNTRY_CODE:
    'Você digitou o código do país duas vezes. Use apenas DDD + número, ex.: (11) 98765-4321.',
  MISSING_DDD: 'Falta o DDD. Comece pelos 2 dígitos da cidade, ex.: (11) 98765-4321.',
  INVALID_DDD: 'DDD inválido. Confira os 2 primeiros dígitos após o código do país.',
  MISSING_NINTH_DIGIT:
    'Celular precisa começar com 9 depois do DDD, ex.: (11) 98765-4321.',
  INVALID_LOCAL: 'Número inválido. Confira DDD e número.',
};

export interface PhoneValidationOk {
  ok: true;
  local: string;      // 10 ou 11 dígitos (sem 55)
  digits: string;     // como será enviado ao backend (só dígitos, sem 55)
  e164: string;       // +55XXXXXXXXXXX
}
export interface PhoneValidationErr {
  ok: false;
  code: PhoneErrorCode;
  message: string;
}
export type PhoneValidationResult = PhoneValidationOk | PhoneValidationErr;

function err(code: PhoneErrorCode): PhoneValidationErr {
  return { ok: false, code, message: PHONE_ERROR_MESSAGES[code] };
}

/**
 * Normaliza a entrada crua — strip de tudo que não é dígito e remoção do
 * prefixo internacional (55) ou do tronco antigo (0).
 */
function stripToLocal(raw: string): { digits: string; local: string } {
  let d = (raw || '').replace(/\D/g, '');

  // Detectar prefixo duplicado (55 55...) já aqui.
  // Removemos um único 55 do começo se levar a um tamanho local plausível.
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) {
    d = d.slice(2);
  }
  // Tronco antigo — 0 na frente ("0 11 9...")
  if (d.length === 11 || d.length === 12) {
    if (d.startsWith('0')) d = d.slice(1);
  }
  return { digits: d, local: d };
}

export function validatePhoneBR(raw: string): PhoneValidationResult {
  const rawDigits = (raw || '').replace(/\D/g, '');
  if (!rawDigits) return err('EMPTY');

  // Prefixo país duplicado: "5555..." ou length > 13
  if (rawDigits.length > 13) return err('DUPLICATED_COUNTRY_CODE');
  if (rawDigits.startsWith('5555')) return err('DUPLICATED_COUNTRY_CODE');

  const { local } = stripToLocal(raw);

  if (local.length < 10) {
    if (local.length === 8 || local.length === 9) return err('MISSING_DDD');
    return err('TOO_SHORT');
  }
  if (local.length > 11) return err('TOO_LONG');

  const ddd = local.slice(0, 2);
  if (!VALID_DDDS.has(ddd)) return err('INVALID_DDD');

  // Celular = 11 dígitos, terceiro dígito deve ser 9.
  if (local.length === 11 && local[2] !== '9') {
    return err('INVALID_LOCAL');
  }
  // Fixo com 10 dígitos: terceiro dígito NÃO pode ser 9 (senão é celular sem o 9).
  // Nesse caso orientamos a incluir o 9.
  if (local.length === 10 && local[2] === '9') {
    return err('MISSING_NINTH_DIGIT');
  }

  return {
    ok: true,
    local,
    digits: local,
    e164: `+55${local}`,
  };
}

/**
 * Máscara BR: aceita entrada com "+55" colado e nunca estoura o limite.
 * Retorna string mascarada de até 11 dígitos locais.
 */
export function maskPhoneBR(raw: string): string {
  let d = (raw || '').replace(/\D/g, '');
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
