// Exclui definitivamente uma galeria: apaga fotos do banco e do R2.
// O histórico financeiro (cobranças) permanece vinculado à sessão via session_id.
// Chamada exclusiva pelo painel do fotógrafo autenticado.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ============ R2 helpers (AWS Signature V4) ============
async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const h = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}
async function hmacHex(key: ArrayBuffer, data: string): Promise<string> {
  const sig = await hmac(key, data);
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function getSigningKey(secret: string, dateStamp: string, region: string, service: string): Promise<ArrayBuffer> {
  const kDate = await hmac(new TextEncoder().encode('AWS4' + secret), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}
async function deleteFromR2(
  accountId: string, accessKeyId: string, secret: string, bucket: string, key: string,
): Promise<boolean> {
  try {
    const host = `${accountId}.r2.cloudflarestorage.com`;
    const date = new Date();
    const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const region = 'auto';
    const service = 's3';
    const canonicalUri = `/${bucket}/${key}`;
    const payloadHash = await sha256Hex('');
    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = ['DELETE', canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [algorithm, amzDate, credentialScope, await sha256Hex(canonicalRequest)].join('\n');
    const signingKey = await getSigningKey(secret, dateStamp, region, service);
    const signature = await hmacHex(signingKey, stringToSign);
    const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const res = await fetch(`https://${host}${canonicalUri}`, {
      method: 'DELETE',
      headers: {
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        Authorization: authorization,
      },
    });
    return res.ok || res.status === 204 || res.status === 404;
  } catch (e) {
    console.error(`[archive-gallery] R2 delete failed for ${key}:`, e);
    return false;
  }
}

// ============ Handler ============
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseAuth = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json().catch(() => ({}));
    const galleryId: string | undefined = body?.galleryId;
    if (!galleryId || typeof galleryId !== 'string') {
      return new Response(JSON.stringify({ success: false, error: 'Missing galleryId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 1. Chama RPC archive_gallery com o JWT do usuário (RPC valida auth.uid())
    const supabaseUserRpc = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: archiveResult, error: rpcErr } = await supabaseUserRpc.rpc('archive_gallery', { p_gallery_id: galleryId });

    if (rpcErr) {
      console.error('[archive-gallery] RPC error:', rpcErr);
      const msg = rpcErr.message || 'archive_gallery failed';
      const status = msg.includes('FORBIDDEN') ? 403 : msg.includes('NOT_FOUND') ? 404 : 500;
      return new Response(JSON.stringify({
        success: false, error: msg, code: 'ARCHIVE_RPC_ERROR',
        pg_code: (rpcErr as any).code, details: (rpcErr as any).details,
      }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const result = archiveResult as {
      success: boolean;
      already_archived?: boolean;
      paths_to_purge?: string[];
      photo_count?: number;
      storage_bytes_freed?: number;
      cobrancas_preservadas?: number;
    };

    if (result?.already_archived) {
      // Galeria já havia sido excluída em chamada anterior — idempotência
      return new Response(JSON.stringify({
        success: true, alreadyDeleted: true, deletedFromStorage: 0, r2Failed: 0,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Purga R2
    const accountId = Deno.env.get('R2_ACCOUNT_ID');
    const accessKey = Deno.env.get('R2_ACCESS_KEY_ID');
    const secretKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const bucket = 'lunari-previews';

    const paths = Array.isArray(result?.paths_to_purge) ? result.paths_to_purge : [];
    let deletedFromStorage = 0;
    const failedPaths: string[] = [];

    if (accountId && accessKey && secretKey && paths.length > 0) {
      // Em chunks paralelos de 20
      for (let i = 0; i < paths.length; i += 20) {
        const chunk = paths.slice(i, i + 20);
        const results = await Promise.all(chunk.map((p) =>
          deleteFromR2(accountId, accessKey, secretKey, bucket, p).then((ok) => ({ p, ok })),
        ));
        for (const r of results) {
          if (r.ok) deletedFromStorage++;
          else failedPaths.push(r.p);
        }
      }
    } else if (!accountId) {
      console.warn('[archive-gallery] R2 credentials missing — skipping purge');
    }

    // 3. Audit log
    await supabaseAdmin.from('audit_log').insert({
      action: failedPaths.length > 0 ? 'gallery_deleted_partial' : 'gallery_deleted',
      actor_type: 'user',
      actor_id: user.id,
      resource_type: 'gallery',
      // gallery_id fica NULL: a galeria já foi apagada fisicamente pelo RPC.
      // O UUID é preservado em metadata.gallery_id para rastreabilidade.
      gallery_id: null,
      ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      user_agent: req.headers.get('user-agent') || null,
      metadata: {
        gallery_id: galleryId,
        photo_count: result.photo_count ?? 0,
        storage_paths_total: paths.length,
        r2_deleted: deletedFromStorage,
        r2_failed: failedPaths.length,
        failed_paths_sample: failedPaths.slice(0, 20),
        cobrancas_preservadas: result.cobrancas_preservadas ?? 0,
      },
    }).then(({ error }) => { if (error) console.warn('[archive-gallery] audit insert error:', error.message); });

    // 3b. Fila de retry para objetos R2 que falharam
    if (failedPaths.length > 0) {
      await supabaseAdmin.from('audit_log').insert({
        action: 'gallery_delete_r2_retry_pending',
        actor_type: 'user',
        actor_id: user.id,
        resource_type: 'gallery',
        gallery_id: null,
        metadata: {
          gallery_id: galleryId,
          failed_paths: failedPaths.slice(0, 200),
          failed_paths_total: failedPaths.length,
        },
      }).then(({ error }) => { if (error) console.warn('[archive-gallery] retry queue insert error:', error.message); });
    }

    return new Response(JSON.stringify({
      success: true,
      galleryId,
      deletedFromStorage,
      r2Failed: failedPaths.length,
      r2FailedSample: failedPaths.slice(0, 10),
      cobrancasPreservadas: result.cobrancas_preservadas ?? 0,
      storageBytesFreed: result.storage_bytes_freed ?? 0,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    console.error('[archive-gallery] fatal:', e);
    return new Response(JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
