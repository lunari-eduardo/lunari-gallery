// Helper compartilhado — sincronização Gallery→Sessão via edge do Gestão.
//
// Contrato (handoff Gestão 2026-07-11):
//   - `public.clientes_sessoes` é propriedade do Gestão.
//   - Toda escrita nessa tabela originada pelo Gallery DEVE passar pela
//     edge `gallery-update-session-photos` (mesmo projeto Supabase).
//   - Chamamos APENAS no momento de finalização (primeira ou pós-reabertura).
//   - A trigger `sync_gallery_extras_to_session` já propaga `qtd_fotos_extra`
//     automaticamente a partir de `galerias`; esta chamada existe para
//     reafirmar `status_galeria` e criar rastro auditável no `audit_log`.
//   - É NON-BLOQUEANTE por design: se falhar, a trigger cobre o estado.

export interface SyncSessionArgs {
  supabase: any;
  galleryId: string;
  sessionId: string;
  correlationId?: string;
}

export interface SyncSessionResult {
  ok: boolean;
  status: number;
  body: unknown;
  skipped?: boolean;
}

const FLAG_ENABLED = (Deno.env.get('USE_GESTAO_SYNC_EDGE') ?? 'true') === 'true';

export function isSessionSyncEnabled(): boolean {
  return FLAG_ENABLED;
}

/**
 * Chama a edge `gallery-update-session-photos` com `selecaoFinalizada: true`.
 * Nunca lança. Falhas viram warning + audit_log; a trigger do banco cobre.
 */
export async function syncSessionOnFinalize(args: SyncSessionArgs): Promise<SyncSessionResult> {
  const { supabase, galleryId, sessionId, correlationId } = args;

  if (!FLAG_ENABLED) {
    return { ok: true, status: 0, body: null, skipped: true };
  }
  if (!sessionId) {
    return { ok: true, status: 0, body: null, skipped: true };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceKey) {
    console.warn('[syncSessionOnFinalize] SUPABASE_URL/SERVICE_ROLE_KEY ausentes — pulando');
    return { ok: false, status: 0, body: 'missing-env', skipped: true };
  }

  const url = `${supabaseUrl}/functions/v1/gallery-update-session-photos`;
  const payload = {
    galeriaId: galleryId,
    sessionId,
    selecaoFinalizada: true,
    correlationId: correlationId ?? null,
    source: 'gallery',
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let body: unknown = text;
    try { body = JSON.parse(text); } catch { /* keep raw */ }

    if (!res.ok) {
      console.warn(`[syncSessionOnFinalize] falha HTTP ${res.status} para galeria ${galleryId}:`, body);
      try {
        await supabase.from('audit_log').insert({
          action: 'SESSION_SYNC_EDGE_FAIL',
          actor_type: 'edge_function',
          resource_type: 'gallery',
          resource_id: galleryId,
          gallery_id: galleryId,
          metadata: { status: res.status, body, correlationId, sessionId },
        });
      } catch (auditErr) {
        console.warn('[syncSessionOnFinalize] audit_log insert falhou:', auditErr);
      }
      return { ok: false, status: res.status, body };
    }

    return { ok: true, status: res.status, body };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[syncSessionOnFinalize] erro de rede para galeria ${galleryId}:`, msg);
    try {
      await supabase.from('audit_log').insert({
        action: 'SESSION_SYNC_EDGE_FAIL',
        actor_type: 'edge_function',
        resource_type: 'gallery',
        resource_id: galleryId,
        gallery_id: galleryId,
        metadata: { error: msg, correlationId, sessionId },
      });
    } catch { /* ignore */ }
    return { ok: false, status: 0, body: msg };
  }
}
