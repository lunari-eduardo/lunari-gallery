/**
 * Validação de CPF/CNPJ (dígito verificador) e máscara dinâmica.
 * Sem dependências externas. Regras oficiais Receita Federal.
 */

export function onlyDigits(v: string): string {
  return (v || '').replace(/\D/g, '');
}

export function isValidCpf(raw: string): boolean {
  const s = onlyDigits(raw);
  if (s.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(s)) return false;
  const calc = (base: string, factorStart: number) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += parseInt(base[i], 10) * (factorStart - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  const d1 = calc(s.slice(0, 9), 10);
  const d2 = calc(s.slice(0, 10), 11);
  return d1 === parseInt(s[9], 10) && d2 === parseInt(s[10], 10);
}

export function isValidCnpj(raw: string): boolean {
  const s = onlyDigits(raw);
  if (s.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(s)) return false;
  const calc = (base: string) => {
    const weights = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += parseInt(base[i], 10) * weights[i];
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const d1 = calc(s.slice(0, 12));
  const d2 = calc(s.slice(0, 13));
  return d1 === parseInt(s[12], 10) && d2 === parseInt(s[13], 10);
}

export function isValidCpfCnpj(raw: string): boolean {
  const s = onlyDigits(raw);
  return s.length === 11 ? isValidCpf(s) : s.length === 14 ? isValidCnpj(s) : false;
}

/** Máscara dinâmica: até 11 dígitos → CPF, a partir de 12 → CNPJ. */
export function maskCpfCnpj(raw: string): string {
  const s = onlyDigits(raw).slice(0, 14);
  if (s.length <= 11) {
    return s
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return s
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}
