import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FROM_EMAIL = 'Lunari <contato@mail.lunarihub.com>';
const GALLERY_BASE_URL = 'https://gallery.lunarihub.com';
const RESEND_API_URL = 'https://api.resend.com/emails';

type EventType = 'gallery_sent' | 'payment_confirmed' | 'gallery_reactivated';
type DeliveryStatus = 'enviado' | 'erro' | 'ignorado';

interface RequestBody {
  eventType?: EventType;
  galleryId?: string;
  paymentId?: string;
  publicToken?: string;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCurrency(value: unknown): string {
  const numberValue = Number(value || 0);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numberValue);
}

function formatDate(value: unknown): string {
  const date = value ? new Date(String(value)) : new Date();
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function formatDateOnly(value: unknown): string {
  if (!value) return 'Sem prazo definido';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(String(value)));
}

function daysRemaining(value: unknown): string {
  if (!value) return '0';
  const today = new Date();
  const deadline = new Date(String(value));
  const diff = deadline.getTime() - today.getTime();
  return String(Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24))));
}

function replaceTemplateVariables(template: string, variables: Record<string, string>) {
  return template.replace(/{(\w+)}/g, (match, key) => variables[key] ?? match);
}

function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

async function getPhotographerReplyTo(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('email')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('profiles reply-to lookup error:', error.message);
    return null;
  }

  const email = typeof data?.email === 'string' ? data.email.trim() : '';
  return isValidEmail(email) ? email : null;
}

function textToHtmlParagraphs(text: string) {
  return escapeHtml(text)
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 18px;color:#211b18;font-size:16px;line-height:1.65;">${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function paymentMethodLabel(payment: any): string {
  if (payment?.metodo_manual) return String(payment.metodo_manual);
  const provider = String(payment?.provedor || '').toLowerCase();
  const type = String(payment?.tipo_cobranca || '').toLowerCase();
  if (provider === 'infinitepay') return 'InfinitePay';
  if (provider === 'mercadopago') return 'Mercado Pago';
  if (provider === 'asaas') {
    if (type === 'pix') return 'PIX via Asaas';
    if (type === 'card') return 'Cartão via Asaas';
    return 'Asaas';
  }
  if (provider === 'manual') return 'Recebimento manual';
  return provider || 'Pagamento';
}

function buildLayout(params: { preview: string; title: string; children: string; buttonUrl?: string; buttonText?: string; studioName: string }) {
  const button = params.buttonUrl ? `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 24px;width:100%;">
      <tr>
        <td align="center">
          <a href="${escapeHtml(params.buttonUrl)}" style="display:inline-block;background:#a4553a;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;line-height:1;border-radius:10px;padding:16px 24px;">${escapeHtml(params.buttonText || 'Acessar')}</a>
        </td>
      </tr>
    </table>` : '';

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(params.title)}</title>
  </head>
  <body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#211b18;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(params.preview)}</div>
    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;background:#ffffff;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;max-width:560px;border:1px solid #eadfd8;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="padding:34px 28px 26px;">
                <p style="margin:0 0 10px;color:#a4553a;font-size:13px;font-weight:700;letter-spacing:.02em;">${escapeHtml(params.studioName)}</p>
                <h1 style="margin:0 0 20px;color:#211b18;font-size:28px;line-height:1.18;font-weight:800;">${escapeHtml(params.title)}</h1>
                ${params.children}
                ${button}
                <p style="margin:28px 0 0;color:#6f625c;font-size:14px;line-height:1.6;">Com carinho,<br><strong>${escapeHtml(params.studioName)}</strong></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendResendEmail(to: string, subject: string, html: string, options: { replyTo?: string | null } = {}) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY_MISSING');
  }

  const payload: Record<string, unknown> = { from: FROM_EMAIL, to: [to], subject, html };
  if (isValidEmail(options.replyTo)) payload.reply_to = options.replyTo.trim();

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`RESEND_SEND_FAILED:${response.status}:${JSON.stringify(data)}`);
  }
  return data?.id ? String(data.id) : null;
}

async function upsertLog(supabase: any, log: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('email_delivery_logs')
    .upsert(log, { onConflict: 'idempotency_key' })
    .select('id')
    .single();

  if (error) console.error('email_delivery_logs upsert error:', error.message);
  return data?.id || null;
}

async function getAuthenticatedUserId(req: Request, supabaseUrl: string, anonKey: string, serviceKey: string) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;
  if (token === serviceKey) return 'service-role';

  const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

async function alreadySent(supabase: any, idempotencyKey: string) {
  const { data } = await supabase
    .from('email_delivery_logs')
    .select('id, status, friendly_message')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  return data?.status === 'enviado' ? data : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== 'POST') return jsonResponse({ success: false, error: 'Método não permitido' }, 405);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({})) as RequestBody;

    if (body.eventType !== 'gallery_sent' && body.eventType !== 'payment_confirmed' && body.eventType !== 'gallery_reactivated') {
      return jsonResponse({ success: false, status: 'erro', message: 'Evento de e-mail inválido' }, 400);
    }

    const callerUserId = await getAuthenticatedUserId(req, supabaseUrl, anonKey, serviceKey);
    if (!callerUserId) return jsonResponse({ success: false, status: 'erro', message: 'Autenticação obrigatória' }, 401);

    if (body.eventType === 'gallery_sent') {
      if (!body.galleryId) return jsonResponse({ success: false, status: 'erro', message: 'Galeria não informada' }, 400);

      const { data: gallery, error: galleryError } = await supabase
        .from('galerias')
        .select('id, user_id, cliente_id, cliente_nome, cliente_email, nome_sessao, permissao, gallery_password, public_token, prazo_selecao, total_fotos, fotos_selecionadas, total_fotos_extras_vendidas, valor_extras')
        .eq('id', body.galleryId)
        .maybeSingle();

      if (galleryError || !gallery) return jsonResponse({ success: false, status: 'erro', message: 'Galeria não encontrada' }, 404);
      if (callerUserId !== 'service-role' && callerUserId !== gallery.user_id) {
        return jsonResponse({ success: false, status: 'erro', message: 'Sem permissão para enviar e-mail desta galeria' }, 403);
      }

      const idempotencyKey = `gallery_sent:${gallery.id}`;
      const sent = await alreadySent(supabase, idempotencyKey);
      if (sent) return jsonResponse({ success: true, status: 'ignorado', message: 'E-mail já enviado anteriormente.', logId: sent.id });

      const { data: settings } = await supabase
        .from('gallery_settings')
        .select('studio_name, email_sending_enabled, email_on_gallery_sent')
        .eq('user_id', gallery.user_id)
        .maybeSingle();

      const baseLog = {
        user_id: gallery.user_id,
        cliente_id: gallery.cliente_id || null,
        cliente_nome: gallery.cliente_nome || null,
        cliente_email: gallery.cliente_email || null,
        event_type: 'gallery_sent',
        gallery_id: gallery.id,
        payment_id: null,
        idempotency_key: idempotencyKey,
        metadata: { source: 'gallery_sent', publicTokenProvided: Boolean(body.publicToken) },
        updated_at: new Date().toISOString(),
      };

      if (settings?.email_sending_enabled === false) {
        await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Envio automático desativado' });
        return jsonResponse({ success: true, status: 'ignorado', message: 'E-mails automáticos estão desativados.' });
      }
      if (settings?.email_on_gallery_sent === false) {
        await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Envio de galeria desativado' });
        return jsonResponse({ success: true, status: 'ignorado', message: 'Envio de e-mail de galeria está desativado.' });
      }
      if (!gallery.cliente_email) {
        await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Cliente sem e-mail cadastrado' });
        return jsonResponse({ success: true, status: 'ignorado', message: 'Cliente não possui e-mail cadastrado.' });
      }

      const token = body.publicToken || gallery.public_token;
      if (!token || token.length < 8) {
        await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Link da galeria indisponível' });
        return jsonResponse({ success: true, status: 'ignorado', message: 'Link da galeria indisponível.' });
      }

      const studioName = settings?.studio_name || 'Lunari';
      const replyTo = await getPhotographerReplyTo(supabase, gallery.user_id);
      const galleryUrl = `${GALLERY_BASE_URL}/g/${encodeURIComponent(token)}`;
      const { data: template } = await supabase
        .from('gallery_email_templates')
        .select('subject, body')
        .eq('user_id', gallery.user_id)
        .eq('type', 'gallery_sent')
        .maybeSingle();

      const variables = {
        cliente: gallery.cliente_nome || 'Cliente',
        galeria: gallery.nome_sessao || 'Galeria',
        prazo: formatDateOnly(gallery.prazo_selecao),
        link: galleryUrl,
        estudio: studioName,
        dias_restantes: daysRemaining(gallery.prazo_selecao),
        total_fotos: String(gallery.total_fotos || gallery.fotos_selecionadas || 0),
        fotos_extras: String(gallery.total_fotos_extras_vendidas || 0),
        valor_extra: formatCurrency(gallery.valor_extras || 0),
      };
      const subject = replaceTemplateVariables(template?.subject || 'Suas fotos já estão prontas ✨', variables);
      const bodyText = replaceTemplateVariables(template?.body || 'Olá {cliente}!\n\nVocê já pode visualizar, escolher suas favoritas e garantir suas fotos.\n\nAcesse sua galeria: {link}\n\nCom carinho,\n{estudio}', variables);
      const passwordLine = gallery.permissao === 'private' && gallery.gallery_password
        ? `<p style="margin:18px 0 0;color:#211b18;font-size:15px;line-height:1.6;"><strong>Senha de acesso:</strong> ${escapeHtml(gallery.gallery_password)}</p>`
        : '';
      const html = buildLayout({
        studioName,
        title: subject,
        preview: 'Você já pode visualizar, escolher suas favoritas e garantir suas fotos.',
        buttonUrl: galleryUrl,
        buttonText: 'Acessar minha galeria',
        children: `
          ${textToHtmlParagraphs(bodyText)}
          ${passwordLine}
        `,
      });

      try {
        const resendMessageId = await sendResendEmail(gallery.cliente_email, subject, html, { replyTo });
        const logId = await upsertLog(supabase, { ...baseLog, status: 'enviado', subject, resend_message_id: resendMessageId, friendly_message: 'E-mail enviado para o cliente', metadata: { ...baseLog.metadata, replyToConfigured: Boolean(replyTo) } });
        return jsonResponse({ success: true, status: 'enviado', message: 'E-mail enviado para o cliente.', logId });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const friendly = errorMessage === 'RESEND_API_KEY_MISSING' ? 'Configuração do Resend ausente' : 'Falha ao enviar pelo provedor';
        await upsertLog(supabase, { ...baseLog, status: 'erro', subject, friendly_message: friendly, error_message: errorMessage, metadata: { ...baseLog.metadata, replyToConfigured: Boolean(replyTo) } });
        return jsonResponse({ success: false, status: 'erro', message: 'Não foi possível enviar o e-mail agora.' });
      }
    }

    if (body.eventType === 'gallery_reactivated') {
      if (!body.galleryId) return jsonResponse({ success: false, status: 'erro', message: 'Galeria não informada' }, 400);

      const { data: gallery, error: galleryError } = await supabase
        .from('galerias')
        .select('id, user_id, cliente_id, cliente_nome, cliente_email, nome_sessao, permissao, gallery_password, public_token, prazo_selecao')
        .eq('id', body.galleryId)
        .maybeSingle();

      if (galleryError || !gallery) return jsonResponse({ success: false, status: 'erro', message: 'Galeria não encontrada' }, 404);
      if (callerUserId !== 'service-role' && callerUserId !== gallery.user_id) {
        return jsonResponse({ success: false, status: 'erro', message: 'Sem permissão para enviar e-mail desta galeria' }, 403);
      }

      const prazoKey = gallery.prazo_selecao ? new Date(String(gallery.prazo_selecao)).toISOString() : 'no_deadline';
      const idempotencyKey = `gallery_reactivated:${gallery.id}:${prazoKey}`;
      const sent = await alreadySent(supabase, idempotencyKey);
      if (sent) return jsonResponse({ success: true, status: 'ignorado', message: 'E-mail já enviado para esta reativação.', logId: sent.id });

      const { data: settings } = await supabase
        .from('gallery_settings')
        .select('studio_name, email_sending_enabled, email_on_gallery_reactivated')
        .eq('user_id', gallery.user_id)
        .maybeSingle();

      const baseLog = {
        user_id: gallery.user_id,
        cliente_id: gallery.cliente_id || null,
        cliente_nome: gallery.cliente_nome || null,
        cliente_email: gallery.cliente_email || null,
        event_type: 'gallery_reactivated',
        gallery_id: gallery.id,
        payment_id: null,
        idempotency_key: idempotencyKey,
        metadata: { source: 'gallery_reactivated', prazo_selecao: gallery.prazo_selecao },
        updated_at: new Date().toISOString(),
      };

      if (settings?.email_sending_enabled === false) {
        await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Envio automático desativado' });
        return jsonResponse({ success: true, status: 'ignorado', message: 'E-mails automáticos estão desativados.' });
      }
      if (settings?.email_on_gallery_reactivated === false) {
        await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Envio de reativação desativado' });
        return jsonResponse({ success: true, status: 'ignorado', message: 'E-mail de reativação está desativado.' });
      }
      if (!gallery.cliente_email) {
        await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Cliente sem e-mail cadastrado' });
        return jsonResponse({ success: true, status: 'ignorado', message: 'Cliente não possui e-mail cadastrado.' });
      }

      const token = body.publicToken || gallery.public_token;
      if (!token || token.length < 8) {
        await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Link da galeria indisponível' });
        return jsonResponse({ success: true, status: 'ignorado', message: 'Link da galeria indisponível.' });
      }

      const studioName = settings?.studio_name || 'Lunari';
      const replyTo = await getPhotographerReplyTo(supabase, gallery.user_id);
      const galleryUrl = `${GALLERY_BASE_URL}/g/${encodeURIComponent(token)}`;
      const { data: template } = await supabase
        .from('gallery_email_templates')
        .select('subject, body')
        .eq('user_id', gallery.user_id)
        .eq('type', 'gallery_reactivated')
        .maybeSingle();

      const variables = {
        cliente: gallery.cliente_nome || 'Cliente',
        galeria: gallery.nome_sessao || 'Galeria',
        prazo: formatDateOnly(gallery.prazo_selecao),
        link: galleryUrl,
        estudio: studioName,
        dias_restantes: daysRemaining(gallery.prazo_selecao),
      };
      const subject = replaceTemplateVariables(template?.subject || 'Sua galeria foi reaberta - {galeria}', variables);
      const bodyText = replaceTemplateVariables(template?.body || 'Olá {cliente}!\n\nBoas notícias: a galeria "{galeria}" foi reaberta para você concluir sua seleção de fotos.\n\nVocê tem até {prazo} para escolher suas favoritas.\n\nAcesse: {link}\n\nCom carinho,\n{estudio}', variables);
      const passwordLine = gallery.permissao === 'private' && gallery.gallery_password
        ? `<p style="margin:18px 0 0;color:#211b18;font-size:15px;line-height:1.6;"><strong>Senha de acesso:</strong> ${escapeHtml(gallery.gallery_password)}</p>`
        : '';
      const html = buildLayout({
        studioName,
        title: subject,
        preview: 'Sua galeria foi reaberta para você concluir a seleção.',
        buttonUrl: galleryUrl,
        buttonText: 'Acessar minha galeria',
        children: `${textToHtmlParagraphs(bodyText)}${passwordLine}`,
      });

      try {
        const resendMessageId = await sendResendEmail(gallery.cliente_email, subject, html, { replyTo });
        const logId = await upsertLog(supabase, { ...baseLog, status: 'enviado', subject, resend_message_id: resendMessageId, friendly_message: 'E-mail de reativação enviado', metadata: { ...baseLog.metadata, replyToConfigured: Boolean(replyTo) } });
        return jsonResponse({ success: true, status: 'enviado', message: 'E-mail enviado para o cliente.', logId });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const friendly = errorMessage === 'RESEND_API_KEY_MISSING' ? 'Configuração do Resend ausente' : 'Falha ao enviar pelo provedor';
        await upsertLog(supabase, { ...baseLog, status: 'erro', subject, friendly_message: friendly, error_message: errorMessage, metadata: { ...baseLog.metadata, replyToConfigured: Boolean(replyTo) } });
        return jsonResponse({ success: false, status: 'erro', message: 'Não foi possível enviar o e-mail agora.' });
      }
    }

    if (!body.paymentId) return jsonResponse({ success: false, status: 'erro', message: 'Pagamento não informado' }, 400);

    const { data: payment, error: paymentError } = await supabase
      .from('cobrancas')
      .select('*')
      .eq('id', body.paymentId)
      .maybeSingle();

    if (paymentError || !payment) return jsonResponse({ success: false, status: 'erro', message: 'Pagamento não encontrado' }, 404);
    if (callerUserId !== 'service-role' && callerUserId !== payment.user_id) {
      return jsonResponse({ success: false, status: 'erro', message: 'Sem permissão para enviar e-mail deste pagamento' }, 403);
    }

    const idempotencyKey = `payment_confirmed:${payment.id}`;
    const sent = await alreadySent(supabase, idempotencyKey);
    if (sent) return jsonResponse({ success: true, status: 'ignorado', message: 'E-mail já enviado anteriormente.', logId: sent.id });

    const [{ data: settings }, { data: client }, { data: gallery }] = await Promise.all([
      supabase.from('gallery_settings').select('studio_name, email_sending_enabled, email_on_payment_confirmed').eq('user_id', payment.user_id).maybeSingle(),
      payment.cliente_id ? supabase.from('clientes').select('id, nome, email').eq('id', payment.cliente_id).maybeSingle() : Promise.resolve({ data: null }),
      payment.galeria_id ? supabase.from('galerias').select('id, cliente_nome, cliente_email, nome_sessao, public_token').eq('id', payment.galeria_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    const clienteNome = client?.nome || gallery?.cliente_nome || 'Cliente';
    const clienteEmail = client?.email || gallery?.cliente_email || null;
    const baseLog = {
      user_id: payment.user_id,
      cliente_id: payment.cliente_id || client?.id || null,
      cliente_nome: clienteNome,
      cliente_email: clienteEmail,
      event_type: 'payment_confirmed',
      gallery_id: payment.galeria_id || null,
      payment_id: payment.id,
      idempotency_key: idempotencyKey,
      metadata: { provider: payment.provedor, chargeType: payment.tipo_cobranca },
      updated_at: new Date().toISOString(),
    };

    if (payment.status !== 'pago' && payment.status !== 'pago_manual') {
      await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Pagamento ainda não confirmado' });
      return jsonResponse({ success: true, status: 'ignorado', message: 'Pagamento ainda não confirmado.' });
    }
    if (settings?.email_sending_enabled === false) {
      await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Envio automático desativado' });
      return jsonResponse({ success: true, status: 'ignorado', message: 'E-mails automáticos estão desativados.' });
    }
    if (settings?.email_on_payment_confirmed === false) {
      await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Confirmação de pagamento desativada' });
      return jsonResponse({ success: true, status: 'ignorado', message: 'E-mail de pagamento desativado.' });
    }
    if (!clienteEmail) {
      await upsertLog(supabase, { ...baseLog, status: 'ignorado', friendly_message: 'Cliente sem e-mail cadastrado' });
      return jsonResponse({ success: true, status: 'ignorado', message: 'Cliente não possui e-mail cadastrado.' });
    }

    const studioName = settings?.studio_name || 'Lunari';
    const replyTo = await getPhotographerReplyTo(supabase, payment.user_id);
    const galleryUrl = gallery?.public_token ? `${GALLERY_BASE_URL}/g/${encodeURIComponent(gallery.public_token)}` : undefined;
    const subject = 'Pagamento confirmado';
    const description = payment.descricao || (payment.qtd_fotos ? `${payment.qtd_fotos} foto(s) extra(s)` : 'Pagamento da galeria');
    const html = buildLayout({
      studioName,
      title: 'Pagamento confirmado',
      preview: `Recebemos a confirmação do seu pagamento de ${formatCurrency(payment.valor)}.`,
      buttonUrl: galleryUrl,
      buttonText: 'Acessar galeria',
      children: `
        <p style="margin:0 0 18px;color:#211b18;font-size:16px;line-height:1.65;">Olá, ${escapeHtml(clienteNome)}.</p>
        <p style="margin:0 0 20px;color:#211b18;font-size:16px;line-height:1.65;">Recebemos a confirmação do seu pagamento.</p>
        <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#fbf7f4;border-radius:12px;margin:20px 0;">
          <tr><td style="padding:14px 16px;color:#6f625c;font-size:14px;">Valor pago</td><td align="right" style="padding:14px 16px;color:#211b18;font-size:14px;font-weight:700;">${escapeHtml(formatCurrency(payment.valor))}</td></tr>
          <tr><td style="padding:14px 16px;color:#6f625c;font-size:14px;border-top:1px solid #eadfd8;">Forma de pagamento</td><td align="right" style="padding:14px 16px;color:#211b18;font-size:14px;border-top:1px solid #eadfd8;">${escapeHtml(paymentMethodLabel(payment))}</td></tr>
          <tr><td style="padding:14px 16px;color:#6f625c;font-size:14px;border-top:1px solid #eadfd8;">Data</td><td align="right" style="padding:14px 16px;color:#211b18;font-size:14px;border-top:1px solid #eadfd8;">${escapeHtml(formatDate(payment.data_pagamento))}</td></tr>
          <tr><td style="padding:14px 16px;color:#6f625c;font-size:14px;border-top:1px solid #eadfd8;">Descrição</td><td align="right" style="padding:14px 16px;color:#211b18;font-size:14px;border-top:1px solid #eadfd8;">${escapeHtml(description)}</td></tr>
          <tr><td style="padding:14px 16px;color:#6f625c;font-size:14px;border-top:1px solid #eadfd8;">Status</td><td align="right" style="padding:14px 16px;color:#2f8f4e;font-size:14px;font-weight:700;border-top:1px solid #eadfd8;">Confirmado</td></tr>
        </table>
      `,
    });

    try {
      const resendMessageId = await sendResendEmail(clienteEmail, subject, html, { replyTo });
      const logId = await upsertLog(supabase, { ...baseLog, status: 'enviado', subject, resend_message_id: resendMessageId, friendly_message: 'E-mail enviado para o cliente', metadata: { ...baseLog.metadata, replyToConfigured: Boolean(replyTo) } });
      return jsonResponse({ success: true, status: 'enviado', message: 'E-mail enviado para o cliente.', logId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const friendly = errorMessage === 'RESEND_API_KEY_MISSING' ? 'Configuração do Resend ausente' : 'Falha ao enviar pelo provedor';
      await upsertLog(supabase, { ...baseLog, status: 'erro', subject, friendly_message: friendly, error_message: errorMessage, metadata: { ...baseLog.metadata, replyToConfigured: Boolean(replyTo) } });
      return jsonResponse({ success: false, status: 'erro', message: 'Não foi possível enviar o e-mail agora.' });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('send-email fatal error:', error);
    return jsonResponse({ success: false, status: 'erro', message: 'Erro interno ao processar e-mail', details: errorMessage }, 500);
  }
});
