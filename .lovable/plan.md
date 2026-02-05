
# Diagnóstico Completo e Plano Definitivo

## Resumo Executivo

Após análise profunda, encontrei **4 problemas críticos** que estão quebrando o sistema. Nenhum deles é configuração sua - são **erros no código** que precisam ser corrigidos.

---

## Os 4 Problemas Reais

### Problema 1: Import errado no Cloudflare Worker WASM

**O que está errado:**
```typescript
// ERRADO (index.ts linha 14-19)
import { PhotonImage, ... } from "@cf-wasm/photon";
```

**O que deveria ser:**
```typescript
// CORRETO para Cloudflare Workers
import { PhotonImage, ... } from "@cf-wasm/photon/workerd";
```

**Por que isso quebra tudo:**
O subpath `/workerd` é **obrigatório** para Cloudflare Workers. Sem ele, o módulo WASM não inicializa, gerando o erro:
```
"Cannot read properties of undefined (reading '__wbindgen_malloc')"
```

**Evidência:** Este erro apareceu quando chamei manualmente o `process-photos`:
```json
{
  "error": "Cannot read properties of undefined (reading '__wbindgen_malloc')",
  "photoId": "a117fe37-0022-420b-9ed0-5b2081e2517a",
  "success": false
}
```

---

### Problema 2: Dois cron jobs, um com URL errada e outro com SQL incorreto

**Job 1 (jobid=1)** - URL INCOMPLETA:
```sql
url := 'https://tlnjspsywycbudhewsfv.supabase.co'
-- FALTA: /functions/v1/process-photos
```
Status: "succeeded" mas não faz nada útil porque a URL não aponta para a função.

**Job 4 (jobid=4)** - ERRO DE TIPO SQL:
```sql
headers := '...'::text  -- ERRADO: precisa ser ::jsonb
```
Erro: `function net.http_post(url => unknown, headers => text, body => jsonb) does not exist`

**Resultado:** O pg_cron roda a cada minuto, mas nenhum dos jobs consegue chamar a Edge Function corretamente.

---

### Problema 3: Bucket R2 inconsistente entre Workers

| Worker | Bucket configurado | Bucket correto |
|--------|-------------------|----------------|
| `gallery-upload` | `lunari-gallery` | `lunari-previews` |
| `image-processor` | `lunari-previews` | `lunari-previews` |

O `gallery-upload` está configurado para bucket errado. Precisa ser `lunari-previews`.

---

### Problema 4: Worker provavelmente deployado com versão "simple"

O README menciona duas versões:
- `index.ts` - Versão completa com WASM (resize real)
- `index.simple.js` - Versão simplificada (sem resize, só copia arquivos)

Se você deployou via Quick Edit com `index.simple.js`, ou se deployou `index.ts` sem o `npm install` completo, o WASM não funciona.

---

## Arquitetura Corrigida

```text
FLUXO ATUAL (QUEBRADO):
========================

Frontend → b2-upload → B2 ✓ (funciona)
                           ↓
                    DB: status = 'uploaded'
                           ↓
pg_cron (jobs 1 e 4) ─────►X (URLs/SQL errados)
                           ↓
process-photos ────────────X (nunca é chamado)
                           ↓
lunari-image-processor ────X (WASM não inicializa)
                           ↓
R2 (lunari-previews) ──────X (vazio)


FLUXO CORRETO (APÓS CORREÇÕES):
================================

Frontend → b2-upload → B2 ✓
                           ↓
                    DB: status = 'uploaded'
                           ↓
pg_cron (corrigido) ───────► process-photos ✓
                                   ↓
                    lunari-image-processor ✓
                    (import correto + npm install)
                                   ↓
                    ├─ thumb (400px)
                    ├─ preview (1200px)
                    └─ preview-wm (watermark)
                                   ↓
                    R2 (lunari-previews) ✓
                                   ↓
                    DB: status = 'ready'
                                   ↓
                    Frontend exibe via CDN ✓
```

---

## Plano de Correção

### Fase 1: Corrigir código do image-processor

**Arquivo:** `cloudflare/workers/image-processor/index.ts`

| Linha | Atual | Correção |
|-------|-------|----------|
| 14-19 | `from "@cf-wasm/photon"` | `from "@cf-wasm/photon/workerd"` |

```typescript
// ANTES (linha 14-19)
import { 
  PhotonImage, 
  SamplingFilter, 
  resize,
  blend
} from "@cf-wasm/photon";

// DEPOIS
import { 
  PhotonImage, 
  SamplingFilter, 
  resize,
  blend
} from "@cf-wasm/photon/workerd";
```

### Fase 2: Corrigir bucket no gallery-upload

**Arquivo:** `cloudflare/workers/gallery-upload/wrangler.toml`

| Linha | Atual | Correção |
|-------|-------|----------|
| 11 | `bucket_name = "lunari-gallery"` | `bucket_name = "lunari-previews"` |

### Fase 3: Instruções de Deploy para você

Após as correções de código, você precisa fazer o redeploy:

```bash
# 1. Deploy do image-processor (com WASM)
cd cloudflare/workers/image-processor
npm install                    # CRÍTICO: instala o WASM
wrangler deploy               # Deploya com WASM bundled

# 2. Deploy do gallery-upload
cd ../gallery-upload
npm install
wrangler deploy
```

**IMPORTANTE:** Não use Quick Edit para o image-processor. O WASM precisa ser bundled pelo wrangler.

### Fase 4: Corrigir pg_cron (SQL para executar no Supabase)

```sql
-- 1. Remover os jobs problemáticos
SELECT cron.unschedule(1);
SELECT cron.unschedule(4);

-- 2. Criar job correto (com tipos explícitos)
SELECT cron.schedule(
  'process-photos-job',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/process-photos'::text,
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsbmpzcHN5d3ljYnVkaGV3c2Z2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ2NTUwMSwiZXhwIjoyMDczMDQxNTAxfQ.UOOeAcmFWOEwQKj8W10T6AX4S2RTQlW5PhgyEuozjgY"}'::jsonb,
    body := '{"batchSize": 10}'::jsonb
  ) AS request_id;
  $$
);
```

---

## Secrets Necessários (Checklist)

### Cloudflare - gallery-upload
| Secret | Valor | Status |
|--------|-------|--------|
| `SUPABASE_URL` | `https://tlnjspsywycbudhewsfv.supabase.co` | (verificar) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sua service role key | (verificar) |
| `SUPABASE_JWT_SECRET` | JWT secret (Base64) do Supabase | (verificar) |

### Cloudflare - lunari-image-processor
| Secret | Valor | Status |
|--------|-------|--------|
| `SUPABASE_URL` | `https://tlnjspsywycbudhewsfv.supabase.co` | (verificar) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sua service role key | (verificar) |
| `WORKER_AUTH_SECRET` | String aleatória (use `openssl rand -hex 32`) | (verificar) |

### Supabase Edge Functions
| Secret | Valor | Status |
|--------|-------|--------|
| `IMAGE_PROCESSOR_URL` | URL do lunari-image-processor Worker | Configurado |
| `IMAGE_PROCESSOR_SECRET` | Mesmo valor de WORKER_AUTH_SECRET | Configurado |

---

## Verificação de Funcionamento

### Teste 1: Health check dos Workers

```bash
# gallery-upload
curl https://cdn.lunarihub.com/health

# image-processor
curl https://lunari-image-processor.SEU-ACCOUNT.workers.dev/health
```

Deve retornar `{"status":"ok"}`

### Teste 2: Chamar process-photos manualmente

```bash
curl -X POST \
  "https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/process-photos" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SUA_ANON_KEY" \
  -d '{"batchSize": 1}'
```

Resultado esperado:
```json
{
  "processed": 1,
  "successful": 1,
  "failed": 0,
  "results": [{"photoId": "xxx", "success": true, ...}]
}
```

### Teste 3: Verificar fotos no banco

```sql
SELECT id, processing_status, thumb_path 
FROM galeria_fotos 
ORDER BY created_at DESC 
LIMIT 5;
```

Deve mostrar `processing_status = 'ready'` e `thumb_path` preenchido.

---

## Resumo das Alterações de Código

| Arquivo | Alteração |
|---------|-----------|
| `cloudflare/workers/image-processor/index.ts` | Corrigir import para `@cf-wasm/photon/workerd` |
| `cloudflare/workers/gallery-upload/wrangler.toml` | Corrigir bucket para `lunari-previews` |

---

## Resposta às suas perguntas

**"Você não sabe como fazer essa integração corretamente?"**
O código tem erros específicos (import path do WASM) que não são óbvios. A documentação do `@cf-wasm/photon` especifica que para Workers você DEVE usar o subpath `/workerd`.

**"Configurei algo de errado?"**
Os secrets parecem estar configurados. O problema é:
1. O código do Worker tem import errado
2. Os cron jobs do Supabase têm URL/SQL incorretos
3. O bucket do gallery-upload está errado

**"Usei o prompt de comando para deployar, fiz certo?"**
Se você fez `npm install` antes do `wrangler deploy`, está correto. Mas se o código ainda tinha o import errado, o WASM não vai funcionar mesmo assim.
