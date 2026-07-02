/**
 * Enriquecimento idempotente do cadastro de clientes após confirmação de pagamento.
 *
 * REGRAS DE SEGURANÇA:
 *  - Só grava se a coluna atual estiver NULL/vazia. NUNCA sobrescreve dado existente.
 *  - `whatsapp` nunca é preenchido automaticamente (canal principal do fotógrafo).
 *  - `email` só grava se passar em regex simples.
 *  - `telefone` só grava se `telefone` E `whatsapp` estiverem vazios.
 *  - Silencioso em erros (nunca falha o webhook).
 *
 * Chamar SOMENTE após o pagamento ser confirmado pelo provedor — assim garantimos
 * que o dado foi validado (email real, telefone real).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface EnrichInput {
  email?: string | null;
  telefone?: string | null;
}

export async function enrichClienteIfMissing(
  supabase: any,
  clienteId: string | null | undefined,
  incoming: EnrichInput,
): Promise<void> {
  try {
    if (!clienteId) return;
    const email = incoming.email?.trim().toLowerCase();
    const telefone = incoming.telefone ? String(incoming.telefone).replace(/\D/g, '') : undefined;

    // Nada útil para gravar
    const hasEmail = email && EMAIL_RE.test(email);
    const hasPhone = telefone && telefone.length >= 10 && telefone.length <= 13;
    if (!hasEmail && !hasPhone) return;

    const { data: current } = await supabase
      .from('clientes')
      .select('email, telefone, whatsapp')
      .eq('id', clienteId)
      .maybeSingle();
    if (!current) return;

    const patch: Record<string, string> = {};
    if (hasEmail && !current.email) patch.email = email!;
    if (hasPhone && !current.telefone && !current.whatsapp) patch.telefone = telefone!;

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
