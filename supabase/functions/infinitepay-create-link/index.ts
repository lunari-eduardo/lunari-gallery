/**
 * v1.0.2 — Auto-heal + validação defensiva (2026-03-21)
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  CONTRATO COMPARTILHADO — NÃO MODIFICAR SEM COORDENAÇÃO    ║
 * ║                                                              ║
 * ║  Esta função é chamada internamente por confirm-selection    ║
 * ║  usando SUPABASE_SERVICE_ROLE_KEY (não JWT de usuário).      ║
 * ║                                                              ║
 * ║  REGRAS IMUTÁVEIS:                                           ║
 * ║  1. NÃO adicionar verificação de JWT (auth.getUser)          ║
 * ║  2. userId DEVE ser aceito no body da request                ║
 * ║  3. verify_jwt DEVE ser false no config.toml                 ║
 * ║  4. Autenticação do fotógrafo é via userId no body           ║
 * ║                                                              ║
 * ║  Projetos: Gallery (Select) + Gestão                         ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface RequestBody {
  clienteId: string;
  sessionId?: string;
  valor: number;
  descricao: string;
  userId: string;
  redirectUrl?: string;
  webhookUrl?: string;
  galleryToken?: string;
  galeriaId?: string;
  qtdFotos?: number;
}

// --- Retry + Timeout helpers ---
const PAYMENT_TIMEOUT = 30_000;
const MAX_RETRIES = 3;

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  attempt = 1,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PAYMENT_TIMEOUT);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);

    // Retry on 5xx or network-level failures
    if (response.status >= 500 && attempt < MAX_RETRIES) {
      const delay = 1000 * Math.pow(2, attempt - 1) + Math.random() * 500;
      console.warn(`⚠️ InfinitePay API returned ${response.status}, retrying in ${Math.round(delay)}ms (attempt ${attempt}/${MAX_RETRIES})`);
      await new Promise(r => setTimeout(r, delay));
      return fetchWithRetry(url, options, attempt + 1);
    }

    return response;
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const errMsg = error instanceof Error ? error.message : String(error);

    if (attempt < MAX_RETRIES) {
      const delay = 1000 * Math.pow(2, attempt - 1) + Math.random() * 500;
      console.warn(`⚠️ InfinitePay API error: ${errMsg}, retrying in ${Math.round(delay)}ms (attempt ${attempt}/${MAX_RETRIES})`);
      await new Promise(r => setTimeout(r, delay));
      return fetchWithRetry(url, options, attempt + 1);
    }

    throw error;
  }
}

function errorResponse(status: number, error: string, code: string, details?: string) {
  return new Response(
    JSON.stringify({ success: false, error, code, details }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { clienteId, sessionId, valor, descricao, userId, redirectUrl, webhookUrl, galleryToken, galeriaId, qtdFotos }: RequestBody = await req.json();

    // Validate required fields - userId is always required (passed in body, no JWT needed)
    if (!valor || !userId) {
      return errorResponse(400, 'valor e userId são obrigatórios', 'MISSING_FIELDS');
    }

    if (!clienteId && !galeriaId) {
      return errorResponse(400, 'É necessário um cliente ou galeria vinculada para criar cobrança', 'MISSING_REFERENCE');
    }

    if (!clienteId && galeriaId) {
      console.log('⚠️ Criando cobrança InfinitePay para galeria pública (sem cliente vinculado)');
    }

    // 1. Fetch InfinitePay handle
    const { data: integracao, error: integracaoError } = await supabase
      .from('usuarios_integracoes')
      .select('dados_extras')
      .eq('user_id', userId)
      .eq('provedor', 'infinitepay')
      .eq('status', 'ativo')
      .maybeSingle();

    if (integracaoError) {
      console.error('Integration fetch error:', integracaoError);
      return errorResponse(500, 'Erro ao buscar integração InfinitePay', 'INTEGRATION_ERROR');
    }

    const handle = (integracao?.dados_extras as { handle?: string })?.handle;

    if (!handle) {
      return errorResponse(400, 'InfinitePay não configurado para este usuário', 'NO_HANDLE');
    }

    // 2. Build payload
    const orderNsu = `gallery-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const valorCentavos = Math.round(valor * 100);

    const infinitePayload: Record<string, unknown> = {
      handle,
      items: [{ quantity: 1, price: valorCentavos, description: descricao.substring(0, 100) }],
      order_nsu: orderNsu,
    };

    // Redirect URL
    if (redirectUrl) {
      infinitePayload.redirect_url = redirectUrl;
    } else if (galleryToken) {
      const baseUrl = 'https://gallery.lunarihub.com';
      infinitePayload.redirect_url = `${baseUrl}/g/${galleryToken}?payment=success`;
      console.log(`💳 Redirect URL: ${infinitePayload.redirect_url}`);
    }

    // Webhook URL
    infinitePayload.webhook_url = webhookUrl || `${supabaseUrl}/functions/v1/infinitepay-webhook`;
    console.log(`💳 Webhook URL: ${infinitePayload.webhook_url}`);

    // 3. Call InfinitePay API with retry + timeout
    console.log(`💳 Calling InfinitePay API...`);

    let infinitePayResponse: Response;
    try {
      infinitePayResponse = await fetchWithRetry(
        'https://api.infinitepay.io/invoices/public/checkout/links',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(infinitePayload),
        },
      );
    } catch (fetchErr: unknown) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.error('💳 InfinitePay API unreachable after retries:', msg);
      return errorResponse(502, 'InfinitePay indisponível. Tente novamente em alguns minutos.', 'INFINITEPAY_UNAVAILABLE', msg);
    }

    console.log(`💳 InfinitePay API status: ${infinitePayResponse.status}`);

    // 4. Validate Content-Type before parsing
    const contentType = infinitePayResponse.headers.get('content-type') || '';
    const responseText = await infinitePayResponse.text();

    if (!contentType.includes('application/json')) {
      console.error(`💳 InfinitePay returned non-JSON (${contentType}):`, responseText.substring(0, 300));
      return errorResponse(502, 'InfinitePay retornou resposta inesperada. Tente novamente.', 'INFINITEPAY_NON_JSON', `Content-Type: ${contentType}`);
    }

    if (!infinitePayResponse.ok) {
      console.error('💳 InfinitePay API error:', responseText.substring(0, 500));
      return errorResponse(502, 'Erro ao criar link de pagamento InfinitePay', 'INFINITEPAY_API_ERROR', responseText.substring(0, 200));
    }

    let infinitePayData: { url?: string; checkout_url?: string; slug?: string };
    try {
      infinitePayData = JSON.parse(responseText);
    } catch {
      console.error('💳 Failed to parse InfinitePay response:', responseText.substring(0, 300));
      return errorResponse(502, 'Resposta inválida da InfinitePay', 'INFINITEPAY_PARSE_ERROR');
    }

    const checkoutUrl = infinitePayData.url || infinitePayData.checkout_url;
    const invoiceSlug = infinitePayData.slug;

    if (!checkoutUrl) {
      console.error('💳 No checkout_url in response:', JSON.stringify(infinitePayData));
      return errorResponse(502, 'InfinitePay não retornou URL de checkout', 'NO_CHECKOUT_URL');
    }

    console.log(`💳 Checkout URL generated: ${checkoutUrl}`);

    // 5. Create charge record
    const { data: cobranca, error: cobrancaError } = await supabase
      .from('cobrancas')
      .insert({
        user_id: userId,
        cliente_id: clienteId || null,
        session_id: sessionId || null,
        valor,
        descricao,
        tipo_cobranca: 'link',
        provedor: 'infinitepay',
        status: 'pendente',
        ip_checkout_url: checkoutUrl,
        ip_order_nsu: orderNsu,
        galeria_id: galeriaId || null,
        qtd_fotos: qtdFotos || 0,
      })
      .select('id')
      .single();

    if (cobrancaError) {
      console.error('Charge creation error:', cobrancaError);
      return errorResponse(500, 'Erro ao criar registro de cobrança', 'CHARGE_DB_ERROR', cobrancaError.message);
    }

    console.log(`✅ Charge created: ${cobranca.id} order_nsu: ${orderNsu}`);

    return new Response(
      JSON.stringify({
        success: true,
        checkoutUrl,
        cobrancaId: cobranca.id,
        orderNsu,
        invoiceSlug,
        provedor: 'infinitepay',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[infinitepay-create-link] Error:', error);
    return errorResponse(500, 'Erro interno do servidor', 'INTERNAL_ERROR', msg);
  }
});
