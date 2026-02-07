
# Plano Definitivo: Upload para R2 com B2 Condicional

## Diagnóstico Final

### Causa do Erro 404
O frontend chama `https://cdn.lunarihub.com/upload`, mas **o Worker nunca foi deployed** via `wrangler deploy`. O código existe no repositório, mas não está rodando no Cloudflare.

### Erro 429 (Build)
Esse é um problema interno temporário do Lovable e não está relacionado ao seu código.

---

## Arquitetura Proposta (Alinhada com Seus Requisitos)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        NOVO FLUXO DE UPLOAD                             │
└─────────────────────────────────────────────────────────────────────────┘

                       ┌─────────────────────────────────────────┐
                       │          1. UPLOAD (Frontend)           │
                       └─────────────────────────────────────────┘
                                          │
                                          ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │              Supabase Edge Function: preview-upload                 │
  │                                                                     │
  │   • Recebe imagem comprimida (1024/1920/2560px) do frontend        │
  │   • Verifica créditos do usuário                                   │
  │   • Faz R2.put() → Cloudflare R2 (via S3 API)                     │
  │   • Salva metadata no Supabase                                     │
  │   • NÃO envia para B2 (original não é salvo por padrão)           │
  └─────────────────────────────────────────────────────────────────────┘
                                          │
                    ┌─────────────────────┴──────────────────────┐
                    │                                            │
                    ▼                                            ▼
           ┌───────────────┐                           ┌────────────────┐
           │ Cloudflare R2 │                           │    Supabase    │
           │ (previews)    │                           │ galeria_fotos  │
           │               │                           │  (metadata)    │
           └───────────────┘                           └────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │                    2. VISUALIZAÇÃO (Runtime)                        │
  │                                                                     │
  │   Cloudflare Image Resizing transforma on-the-fly:                 │
  │   • Thumbnail: width=400                                           │
  │   • Preview: width=1920 + draw (watermark)                         │
  │                                                                     │
  │   URL: lunarihub.com/cdn-cgi/image/width=X/media.lunarihub.com/... │
  └─────────────────────────────────────────────────────────────────────┘

                       ┌─────────────────────────────────────────┐
                       │          3. DOWNLOAD (Condicional)      │
                       └─────────────────────────────────────────┘
                                          │
                                          ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │   Quando allowDownload = true e galeria finalizada:                │
  │                                                                     │
  │   Opção A: Servir diretamente do R2 (preview em alta resolução)   │
  │   Opção B: Upload separado para B2 (original não comprimido)       │
  │                                                                     │
  │   Para V1: Servir do R2 é suficiente se preview é 2560px          │
  └─────────────────────────────────────────────────────────────────────┘
```

---

## Solução: Nova Edge Function para R2

Como o Worker Cloudflare requer deploy manual via `wrangler`, vou criar uma **Edge Function Supabase** que faz upload direto para R2 usando a **API S3-compatível**.

### Por Que Edge Function?

| Aspecto | Worker Cloudflare | Edge Function Supabase |
|---------|-------------------|------------------------|
| Deploy | Manual (wrangler) | Automático (Lovable) |
| Auth | JWKS (complexo) | Supabase nativo |
| R2 Access | R2 Binding | S3 API (compatível) |
| Manutenção | Dois sistemas | Centralizado |

### Requisitos de Configuração

Para conectar a Edge Function ao R2 via S3 API, preciso de:

| Secret | Descrição | Como Obter |
|--------|-----------|------------|
| `R2_ACCOUNT_ID` | ID da conta Cloudflare | Dashboard → R2 → Overview |
| `R2_ACCESS_KEY_ID` | Chave de acesso S3 | R2 → Manage R2 API Tokens |
| `R2_SECRET_ACCESS_KEY` | Segredo S3 | R2 → Manage R2 API Tokens |
| `R2_BUCKET_NAME` | Nome do bucket | `lunari-previews` |

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/r2-upload/index.ts` | **Criar** | Nova Edge Function para R2 |
| `src/components/PhotoUploader.tsx` | **Modificar** | Chamar `r2-upload` em vez do Worker |
| `src/lib/photoUrl.ts` | **Manter** | Já está correto para R2 |
| `.env` | **Manter** | URLs já configuradas |

---

## Código da Edge Function: r2-upload

```typescript
// supabase/functions/r2-upload/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// R2 S3-compatible endpoint
function getR2Endpoint(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

// Upload to R2 using S3-compatible API with AWS Signature V4
async function uploadToR2(
  accountId: string,
  accessKeyId: string,
  secretAccessKey: string,
  bucketName: string,
  key: string,
  body: ArrayBuffer,
  contentType: string
): Promise<void> {
  const endpoint = getR2Endpoint(accountId);
  const url = `${endpoint}/${bucketName}/${key}`;
  
  const date = new Date();
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  
  const region = 'auto';
  const service = 's3';
  
  // Create canonical request
  const method = 'PUT';
  const canonicalUri = `/${bucketName}/${key}`;
  const canonicalQueryString = '';
  
  const payloadHash = await sha256Hex(body);
  
  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${accountId}.r2.cloudflarestorage.com`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join('\n') + '\n';
  
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  
  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256Hex(new TextEncoder().encode(canonicalRequest)),
  ].join('\n');
  
  // Calculate signature
  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = await hmacHex(signingKey, stringToSign);
  
  // Create authorization header
  const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      'Authorization': authorization,
    },
    body,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`R2 upload failed: ${response.status} - ${error}`);
  }
}

// Helper functions for AWS Signature V4
async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmac(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

async function hmacHex(key: ArrayBuffer, data: string): Promise<string> {
  const sig = await hmac(key, data);
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getSignatureKey(
  key: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  const kDate = await hmac(new TextEncoder().encode('AWS4' + key).buffer, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`[${requestId}] R2 upload request started`);

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse form data
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const galleryId = formData.get("galleryId") as string;
    const originalFilename = formData.get("originalFilename") as string;
    const width = parseInt(formData.get("width") as string) || 0;
    const height = parseInt(formData.get("height") as string) || 0;

    if (!file || !galleryId) {
      return new Response(JSON.stringify({ error: "Arquivo e galleryId são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify gallery belongs to user
    const { data: gallery, error: galleryError } = await supabase
      .from("galerias")
      .select("id, user_id")
      .eq("id", galleryId)
      .single();

    if (galleryError || !gallery || gallery.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Galeria não encontrada ou sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check credits (same logic as b2-upload)
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!isAdmin) {
      const { data: creditConsumed, error: creditError } = await supabase.rpc(
        'consume_photo_credits',
        { _user_id: user.id, _gallery_id: galleryId, _photo_count: 1 }
      );

      if (creditError || !creditConsumed) {
        return new Response(
          JSON.stringify({ 
            error: 'Créditos insuficientes',
            code: 'INSUFFICIENT_CREDITS'
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // R2 credentials
    const r2AccountId = Deno.env.get("R2_ACCOUNT_ID");
    const r2AccessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
    const r2SecretKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const r2BucketName = Deno.env.get("R2_BUCKET_NAME") || "lunari-previews";

    if (!r2AccountId || !r2AccessKeyId || !r2SecretKey) {
      console.error(`[${requestId}] R2 credentials not configured`);
      return new Response(JSON.stringify({ error: "Configuração de storage incompleta" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate path
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().slice(0, 8);
    const extension = file.name.split(".").pop() || "jpg";
    const filename = `${timestamp}-${randomId}.${extension}`;
    const storagePath = `galleries/${galleryId}/${filename}`;

    // Read file
    const fileData = await file.arrayBuffer();

    console.log(`[${requestId}] Uploading to R2: ${storagePath} (${(fileData.byteLength / 1024).toFixed(0)}KB)`);

    // Upload to R2
    await uploadToR2(
      r2AccountId,
      r2AccessKeyId,
      r2SecretKey,
      r2BucketName,
      storagePath,
      fileData,
      file.type || "image/jpeg"
    );

    console.log(`[${requestId}] R2 upload complete`);

    // Save to database
    const { data: photo, error: insertError } = await supabase
      .from("galeria_fotos")
      .insert({
        galeria_id: galleryId,
        user_id: user.id,
        filename,
        original_filename: originalFilename || file.name,
        storage_key: storagePath,
        thumb_path: storagePath,
        preview_path: storagePath,
        file_size: fileData.byteLength,
        mime_type: file.type || "image/jpeg",
        width,
        height,
        is_selected: false,
        order_index: 0,
        processing_status: 'ready',
      })
      .select()
      .single();

    if (insertError) {
      console.error(`[${requestId}] DB error:`, insertError);
      return new Response(JSON.stringify({ error: "Erro ao salvar metadados" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update gallery photo count
    await supabase.rpc('increment_gallery_photo_count', { gallery_id: galleryId });

    const duration = Date.now() - startTime;
    console.log(`[${requestId}] ✓ Complete in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        photo: {
          id: photo.id,
          filename: photo.filename,
          originalFilename: photo.original_filename,
          storageKey: photo.storage_key,
          fileSize: photo.file_size,
          mimeType: photo.mime_type,
          width: photo.width,
          height: photo.height,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[${requestId}] Error:`, error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

---

## Modificação do PhotoUploader

```typescript
// ANTES: chamava Worker que não existe
const R2_UPLOAD_URL = import.meta.env.VITE_R2_UPLOAD_URL || 'https://cdn.lunarihub.com';
const response = await fetch(`${R2_UPLOAD_URL}/upload`, {...});

// DEPOIS: chama Edge Function do Supabase
const { data, error } = await supabase.functions.invoke('r2-upload', {
  body: formData,
});
```

---

## Configuração Necessária (Ação do Usuário)

Você precisa fornecer os seguintes dados para eu configurar os secrets:

| Secret | Onde Encontrar |
|--------|----------------|
| `R2_ACCOUNT_ID` | Cloudflare Dashboard → R2 → Overview → Account ID |
| `R2_ACCESS_KEY_ID` | Cloudflare Dashboard → R2 → Manage R2 API Tokens → Create |
| `R2_SECRET_ACCESS_KEY` | Gerado junto com o Access Key ID |

Esses valores são configurados como **Supabase Secrets** e deployados automaticamente pelo Lovable.

---

## Resumo da Arquitetura Final

| Etapa | Componente | Destino | Notas |
|-------|------------|---------|-------|
| Upload | Edge Function `r2-upload` | **R2** | Preview comprimido (1024/1920/2560) |
| Visualização | Cloudflare Image Resizing | R2 → Browser | Thumbnails + watermark runtime |
| Download | (Condicional) | R2 direto | Sem watermark, se `allowDownload=true` |
| Original B2 | **Desativado** | N/A | Não salva original por padrão |

---

## Próximos Passos

1. **Você fornece** os 3 secrets R2 (Account ID, Access Key, Secret Key)
2. Eu **crio** a Edge Function `r2-upload`
3. Eu **atualizo** `PhotoUploader.tsx` para usar a Edge Function
4. O deploy é **automático** pelo Lovable
5. Você **testa** upload de uma foto
