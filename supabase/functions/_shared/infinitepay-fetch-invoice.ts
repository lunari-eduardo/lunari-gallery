/**
 * Consulta detalhes de um invoice pago na InfinitePay para recuperar os dados
 * do pagador (nome, email, telefone) que o cliente digitou no checkout hospedado.
 *
 * A InfinitePay NÃO envia estes campos no webhook nem no polling /payment_check,
 * então esta é a ÚNICA forma de resgatar o email digitado no checkout.
 *
 * Contrato observado (checkout.infinitepay.io):
 *   GET https://api.checkout.infinitepay.io/invoices/{slug}
 *     -> { customer: { name, email, phone_number }, paid, ... }
 *
 * Silencioso em erro. Timeout curto (4s) para não segurar o webhook.
 */

const INFINITEPAY_API_BASE =
  Deno.env.get('INFINITEPAY_API_BASE') || 'https://api.checkout.infinitepay.io';

export interface InfinitePayCustomer {
  name?: string;
  email?: string;
  phone_number?: string;
}

export async function fetchInfinitePayInvoice(
  slug: string,
): Promise<{ customer?: InfinitePayCustomer } | null> {
  if (!slug) return null;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${INFINITEPAY_API_BASE}/invoices/${encodeURIComponent(slug)}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(t);

    if (!res.ok) {
      console.warn(`[fetchInfinitePayInvoice] HTTP ${res.status} para slug=${slug}`);
      return null;
    }
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.warn('[fetchInfinitePayInvoice] resposta não-JSON');
      await res.text().catch(() => '');
      return null;
    }
    const data = await res.json().catch(() => null);
    if (!data || typeof data !== 'object') return null;

    // Aceita diferentes formatos possíveis (customer aninhado ou raiz).
    const customer: InfinitePayCustomer | undefined =
      (data as any).customer ||
      ((data as any).payer as InfinitePayCustomer) ||
      undefined;

    return { customer };
  } catch (err) {
    console.warn('[fetchInfinitePayInvoice] exceção:',
      err instanceof Error ? err.message : String(err));
    return null;
  }
}
