
# Plano Completo: Sistema de Watermark e Pipeline de Processamento de Imagens

## Diagnóstico Executivo

Após análise profunda, identifiquei **5 problemas críticos** que impedem o funcionamento do sistema:

---

## Problema 1: Upload de Watermark falha com 401 (JWT)

**Sintoma**: Erro "Assinatura do token inválida ou expirada" ao tentar fazer upload de watermark.

**Causa Raiz**: O Worker `gallery-upload` ainda não foi redeployado com o código atualizado que decodifica o JWT Secret de Base64 para bytes.

**Evidência**: O código no repositório (`cloudflare/workers/gallery-upload/index.ts`) já contém a correção com `base64ToUint8Array()`, mas o Worker implantado no Cloudflare provavelmente ainda usa a versão antiga.

**Solução**: Redeploy manual do Worker `gallery-upload` com o código atualizado.

---

## Problema 2: pg_cron com URL incorreta

**Sintoma**: Fotos ficam eternamente com `processing_status = 'uploaded'`.

**Causa Raiz**: O job pg_cron está apontando para URL errada:

```text
ERRADO:  'https://tlnjspsywycbudhewsfv.supabase.co'
CORRETO: 'https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/process-photos'
```

**Evidência**: Consulta na tabela `cron.job` mostra URL incompleta.

**Solução**: Executar SQL para corrigir o job.

---

## Problema 3: Worker `lunari-image-processor` retorna 401

**Sintoma**: Quando `process-photos` é executado, Worker retorna `401 Unauthorized`.

**Causa Raiz**: O `IMAGE_PROCESSOR_SECRET` configurado no Supabase não bate com o `WORKER_AUTH_SECRET` configurado no Cloudflare Worker.

**Evidência**: Erro `{"error":"Worker failed: 401 - Unauthorized"}` ao chamar a Edge Function.

**Solução**: Verificar e sincronizar os secrets entre Supabase e Cloudflare.

---

## Problema 4: Secrets faltando no Supabase

**Sintoma**: Edge Function `process-photos` não consegue chamar o Worker.

**Evidência**: Lista de secrets não contém `IMAGE_PROCESSOR_URL` e `IMAGE_PROCESSOR_SECRET`.

**Secrets atuais**:
- B2_APPLICATION_KEY
- B2_APPLICATION_KEY_ID
- B2_BUCKET_ID
- B2_BUCKET_NAME
- CLOUDINARY_CLOUD_NAME (legado - pode remover)
- MERCADOPAGO_ACCESS_TOKEN
- MERCADOPAGO_APP_ID
- MERCADOPAGO_APP_SECRET
- MERCADOPAGO_PUBLIC_KEY

**Secrets faltando**:
- `IMAGE_PROCESSOR_URL`
- `IMAGE_PROCESSOR_SECRET`

---

## Problema 5: Bucket R2 com nome inconsistente

**Sintoma**: Upload pode ir para bucket errado.

**Evidência**:
- `gallery-upload/wrangler.toml`: `bucket_name = "lunari-previews"`
- `image-processor/wrangler.toml`: `bucket_name = "lunari-gallery"`

**Nota**: O usuário confirmou que o bucket correto é `lunari-previews`. Precisa corrigir o `wrangler.toml` do image-processor.

---

## Arquitetura do Sistema (Atual vs Esperado)

```text
FLUXO ATUAL (QUEBRADO):
========================

Frontend (PhotoUploader)
      │
      ▼
Edge Function: b2-upload ──────────────────┐
      │                                    │
      ▼                                    │
Backblaze B2 (originais)                   │
      │                                    │
      ▼                                    │
DB: galeria_fotos                          │
(processing_status = 'uploaded')           │
      │                                    │
      ▼                                    │
pg_cron ──────────────────────────────────►│ URL ERRADA ❌
      │                                    │
      X                                    │
      │                                    │
process-photos (nunca executa)             │
      │                                    │
      X                                    │
      │                                    │
lunari-image-processor (401) ❌            │
      │                                    │
      X                                    │
      │                                    │
R2 (lunari-previews) ─────────────────────►│ VAZIO ❌
```

```text
FLUXO ESPERADO (CORRIGIDO):
============================

Frontend (PhotoUploader)
      │
      ▼
Edge Function: b2-upload
      │
      ▼
Backblaze B2 (originais) ✓
      │
      ▼
DB: galeria_fotos
(processing_status = 'uploaded')
      │
      ▼
pg_cron (cada minuto)
      │ URL correta ✓
      ▼
Edge Function: process-photos
      │
      │ secrets válidos ✓
      ▼
Cloudflare Worker: lunari-image-processor
      │
      ├── Busca original do B2
      ├── Gera: thumb (400px)
      ├── Gera: preview (1200px)
      └── Gera: preview-wm (com watermark)
      │
      ▼
R2 (lunari-previews) ✓
      │
      ▼
DB: galeria_fotos
(processing_status = 'ready')
(thumb_path, preview_path, preview_wm_path preenchidos)
      │
      ▼
Frontend exibe fotos via CDN ✓
```

---

## Plano de Correção Detalhado

### Fase 1: Corrigir Infraestrutura Cloudflare

#### 1.1 Redeploy do Worker `gallery-upload`

O código já está correto no repositório. Precisa apenas fazer deploy:

```bash
cd cloudflare/workers/gallery-upload
npm install
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put SUPABASE_JWT_SECRET
wrangler deploy
```

**Verificar secrets no Cloudflare**:
- `SUPABASE_URL`: `https://tlnjspsywycbudhewsfv.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: (sua service role key)
- `SUPABASE_JWT_SECRET`: (o JWT secret Base64 do Supabase)

#### 1.2 Corrigir `wrangler.toml` do image-processor

Alterar `bucket_name` de `lunari-gallery` para `lunari-previews`:

```toml
[[r2_buckets]]
binding = "GALLERY_BUCKET"
bucket_name = "lunari-previews"  # Corrigir aqui
```

#### 1.3 Redeploy do Worker `lunari-image-processor`

```bash
cd cloudflare/workers/image-processor
npm install
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put WORKER_AUTH_SECRET
wrangler deploy
```

**Importante**: Gere uma string forte para `WORKER_AUTH_SECRET` e guarde para usar no Supabase.

---

### Fase 2: Configurar Secrets no Supabase

No painel Supabase, em Edge Functions > Secrets, adicionar:

| Secret                  | Valor                                              |
|-------------------------|----------------------------------------------------|
| `IMAGE_PROCESSOR_URL`   | `https://lunari-image-processor.eduardo22diehl.workers.dev` |
| `IMAGE_PROCESSOR_SECRET`| (mesma string usada em WORKER_AUTH_SECRET)        |

---

### Fase 3: Corrigir pg_cron Job

Executar no SQL Editor do Supabase:

```sql
-- Corrigir o job existente
SELECT cron.unschedule(1);

SELECT cron.schedule(
  'process-pending-photos',
  '* * * * *',  -- A cada minuto
  $$
  SELECT net.http_post(
    url := 'https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/process-photos',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsbmpzcHN5d3ljYnVkaGV3c2Z2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ2NTUwMSwiZXhwIjoyMDczMDQxNTAxfQ.UOOeAcmFWOEwQKj8W10T6AX4S2RTQlW5PhgyEuozjgY"}'::jsonb,
    body := '{"batchSize": 10}'::jsonb
  ) AS request_id;
  $$
);
```

---

### Fase 4: Testar Pipeline Completo

#### 4.1 Testar Upload de Watermark

1. Navegue para Configurações > Personalização
2. Selecione "Personalizada" em Marca d'água
3. Faça upload de um PNG com transparência
4. Verifique nos logs do Cloudflare se aparece `Auth OK: user=...`

#### 4.2 Testar Processamento de Fotos

1. Execute manualmente:
   ```bash
   curl -X POST "https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/process-photos" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -d '{"batchSize": 5}'
   ```

2. Verifique se fotos mudam de `uploaded` para `ready`:
   ```sql
   SELECT id, processing_status, thumb_path 
   FROM galeria_fotos 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

3. Verifique se arquivos aparecem no bucket R2 `lunari-previews`.

---

## Melhorias no Frontend (Fase 5)

### 5.1 Adicionar opção "Personalizada" na criação de galeria

Atualmente, a criação de galeria só permite "Padrão" ou "Nenhuma". Precisamos adicionar a opção de usar a watermark personalizada do fotógrafo.

**Arquivo**: `src/pages/GalleryCreate.tsx`

Adicionar ao RadioGroup de watermark:

```tsx
<RadioGroup value={watermarkType} ...>
  <div className="flex items-center">
    <RadioGroupItem value="standard" ... />
    <Label>Padrão</Label>
  </div>
  
  {/* NOVO: Opção personalizada */}
  <div className="flex items-center">
    <RadioGroupItem value="custom" ... />
    <Label>Minha marca</Label>
  </div>
  
  <div className="flex items-center">
    <RadioGroupItem value="none" ... />
    <Label>Nenhuma</Label>
  </div>
</RadioGroup>
```

### 5.2 Mostrar preview da watermark personalizada

Se o fotógrafo tem watermark personalizada configurada, mostrar preview quando selecionar "Minha marca".

### 5.3 Sincronizar configurações da galeria com photographer_accounts

Quando galeria é criada com `watermarkType: 'custom'`, o processador precisa saber usar a watermark do `photographer_accounts.watermark_path`.

---

## Arquivos que Precisam ser Modificados

| Arquivo | Alteração | Prioridade |
|---------|-----------|------------|
| `cloudflare/workers/image-processor/wrangler.toml` | Corrigir bucket_name para `lunari-previews` | Alta |
| `cloudflare/workers/gallery-upload/index.ts` | Já está correto - precisa redeploy | Alta |
| `supabase/config.toml` | Já está correto | - |
| `src/pages/GalleryCreate.tsx` | Adicionar opção "custom" watermark | Média |
| `src/hooks/useWatermarkSettings.ts` | Já está correto | - |

---

## Checklist de Configuração

### Cloudflare Workers

- [ ] `gallery-upload` secrets configurados:
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `SUPABASE_JWT_SECRET` (Base64)
  
- [ ] `lunari-image-processor` secrets configurados:
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `WORKER_AUTH_SECRET`

- [ ] R2 Bucket `lunari-previews`:
  - [ ] Binding correto em ambos workers
  - [ ] Permissões de escrita

### Supabase

- [ ] Secrets configurados:
  - [ ] `IMAGE_PROCESSOR_URL`
  - [ ] `IMAGE_PROCESSOR_SECRET`
  - [ ] `B2_APPLICATION_KEY_ID`
  - [ ] `B2_APPLICATION_KEY`
  - [ ] `B2_BUCKET_ID`
  - [ ] `B2_BUCKET_NAME`

- [ ] pg_cron job corrigido com URL completa

### Frontend

- [ ] `.env` configurado:
  - [ ] `VITE_R2_PUBLIC_URL=https://cdn.lunarihub.com`
  - [ ] `VITE_B2_BUCKET_URL=https://f005.backblazeb2.com/file/lunari-gallery`

---

## Resultado Esperado

Após todas as correções:

1. **Upload de watermark funciona** - fotógrafo pode fazer upload de PNG personalizado
2. **Fotos são processadas automaticamente** - a cada minuto, pg_cron dispara processamento
3. **R2 recebe derivados** - thumb, preview, preview-wm são gerados e salvos
4. **Frontend exibe fotos corretamente** - usando CDN para thumbnails e previews
5. **Watermarks aplicadas conforme configuração** - system, custom, ou none

---

## Seção Técnica: Fluxo de Dados Detalhado

### Upload de Foto

```text
1. PhotoUploader comprime imagem (maxLongEdge: 1024/1920/2560)
2. FormData enviado para b2-upload Edge Function
3. b2-upload valida token, verifica créditos, faz upload para B2
4. Registro criado em galeria_fotos com processing_status = 'uploaded'
```

### Processamento Assíncrono

```text
1. pg_cron dispara a cada minuto
2. process-photos busca fotos com status = 'uploaded'
3. Marca fotos como 'processing'
4. Envia lote para lunari-image-processor Worker
5. Worker:
   a. Busca original do B2
   b. Gera thumb (400px long edge)
   c. Gera preview (1200px long edge)
   d. Gera preview-wm (1200px + watermark overlay)
   e. Upload para R2
   f. Atualiza DB com paths e status = 'ready'
```

### Exibição no Frontend

```text
1. ClientGallery busca fotos
2. getPhotoUrlWithFallback verifica processing_status
3. Se 'ready': usa R2 paths (thumb_path, preview_path, preview_wm_path)
4. Se não 'ready': mostra placeholder-processing.svg
5. CDN (cdn.lunarihub.com) serve imagens do R2
```
