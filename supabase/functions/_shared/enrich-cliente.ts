/**
 * Enriquecimento idempotente do cadastro de clientes após confirmação de pagamento.
 *
 * REGRAS DE SEGURANÇA:
 *  - Só grava se a coluna atual estiver NULL/vazia. NUNCA sobrescreve dado existente.
 *  - `whatsapp` nunca é preenchido automaticamente (canal principal do fotógrafo).
 *  - `email` só grava se passar em regex simples.
 *  - `telefone` só grava se `telefone` E `whatsapp` estiverem vazios.
 *  - `cpf_cnpj` só grava se estiver vazio (11 ou 14 dígitos válidos).
 *  - Endereço (cep, endereco, endereco_numero, bairro, cidade, uf, endereco_complemento)
 *    é gravado por campo: cada coluna só é preenchida se estiver vazia.
 *  - Silencioso em erros (nunca falha o webhook).
 *
 * Chamar SOMENTE após o pagamento ser confirmado pelo provedor — assim garantimos
 * que o dado foi validado (email real, telefone real, CPF real).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface EnrichInput {
  email?: string | null;
  telefone?: string | null;
  cpfCnpj?: string | null;
  cep?: string | null;
  endereco?: string | null;
  enderecoNumero?: string | null;
  enderecoComplemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
}

function normDigits(v?: string | null, minLen = 1, maxLen = 40): string | undefined {
  if (!v) return undefined;
  const d = String(v).replace(/\D/g, '');
  if (d.length < minLen || d.length > maxLen) return undefined;
  return d;
}

function normText(v?: string | null, maxLen = 255): string | undefined {
  if (!v) return undefined;
  const t = String(v).trim();
  if (!t || t.length > maxLen) return undefined;
  return t;
}

export async function enrichClienteIfMissing(
  supabase: any,
  clienteId: string | null | undefined,
  incoming: EnrichInput,
): Promise<void> {
  try {
    if (!clienteId) return;

    const email = incoming.email?.trim().toLowerCase();
    const telefone = normDigits(incoming.telefone, 10, 13);
    const cpfRaw = normDigits(incoming.cpfCnpj, 11, 14);
    const cpfCnpj = cpfRaw && (cpfRaw.length === 11 || cpfRaw.length === 14) ? cpfRaw : undefined;
    const cep = normDigits(incoming.cep, 8, 8);
    const endereco = normText(incoming.endereco);
    const enderecoNumero = normText(incoming.enderecoNumero, 20);
    const enderecoComplemento = normText(incoming.enderecoComplemento);
    const bairro = normText(incoming.bairro);
    const cidade = normText(incoming.cidade);
    const uf = incoming.uf?.trim().toUpperCase();
    const ufValid = uf && /^[A-Z]{2}$/.test(uf) ? uf : undefined;

    const hasEmail = email && EMAIL_RE.test(email);
    const hasAnything = hasEmail || telefone || cpfCnpj || cep || endereco || enderecoNumero ||
      enderecoComplemento || bairro || cidade || ufValid;
    if (!hasAnything) return;

    const { data: current } = await supabase
      .from('clientes')
      .select('email, telefone, whatsapp, cpf_cnpj, cep, endereco, endereco_numero, endereco_complemento, bairro, cidade, uf')
      .eq('id', clienteId)
      .maybeSingle();
    if (!current) return;

    const patch: Record<string, string> = {};
    if (hasEmail && !current.email) patch.email = email!;
    if (telefone && !current.telefone && !current.whatsapp) patch.telefone = telefone;
    if (cpfCnpj && !current.cpf_cnpj) patch.cpf_cnpj = cpfCnpj;
    if (cep && !current.cep) patch.cep = cep;
    if (endereco && !current.endereco) patch.endereco = endereco;
    if (enderecoNumero && !current.endereco_numero) patch.endereco_numero = enderecoNumero;
    if (enderecoComplemento && !current.endereco_complemento) patch.endereco_complemento = enderecoComplemento;
    if (bairro && !current.bairro) patch.bairro = bairro;
    if (cidade && !current.cidade) patch.cidade = cidade;
    if (ufValid && !current.uf) patch.uf = ufValid;

    if (Object.keys(patch).length === 0) return;

    const { error } = await supabase
      .from('clientes')
      .update(patch)
      .eq('id', clienteId);

    if (error) {
      console.warn('[enrichClienteIfMissing] update failed:', error.message);
    } else {
      console.log(`✅ [enrichClienteIfMissing] cliente ${clienteId} enriquecido:`, Object.keys(patch).join(', '));
    }
  } catch (e) {
    console.warn('[enrichClienteIfMissing] exception:', e instanceof Error ? e.message : String(e));
  }
}
