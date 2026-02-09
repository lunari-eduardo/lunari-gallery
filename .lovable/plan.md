

# Plano: Migrar Originais de B2 para R2 (Eliminar Backblaze)

## Resumo Executivo

Sim, migrar os arquivos originais para o Cloudflare R2 resolve **definitivamente** todos os problemas de download. O R2 ja e usado para previews e funciona perfeitamente. O B2 e a unica fonte de falhas.

**Resultado**: infraestrutura simplificada com UM unico provedor de storage (Cloudflare R2), eliminando toda a complexidade de autenticacao B2, signed URLs, e problemas de CORS.

## Por que R2 resolve o download

```text
HOJE (B2 - quebrado):
Browser --> Edge Function (gera signed URL B2) --> Browser --> B2 privado
                                                       ^
                                                  FALHA: auth, CORS, Content-Disposition

COM R2 (simples):
Browser --> Worker (GET /download/{path}) --> R2 bucket (mesmo Worker ja tem binding)
                |
                v
            Response com Content-Disposition: attachment
            Content-Type: image/jpeg
            [streaming do arquivo]
```

O Cloudflare Worker ja tem binding direto ao bucket R2 (`GALLERY_BUCKET`). Nao precisa de autenticacao, API calls, signed URLs, ou CORS. E uma leitura direta do bucket.

## Mapeamento Completo da Mudanca

### Arquivos que MUDAM

| Arquivo | Mudanca |
|---------|---------|
| `cloudflare/workers/gallery-upload/index.ts` | Adicionar rota `/download/{path}` para servir originais com Content-Disposition |
| `src/components/PhotoUploader.tsx` | Upload original vai para R2 (Worker) em vez de B2 (Edge Function) |
| `src/lib/downloadUtils.ts` | Reescrever: URL direta para Worker em vez de Edge Function b2-download-url |
| `src/components/Lightbox.tsx` | Simplificar handleDownload para usar Worker URL |
| `src/components/FinalizedPreviewScreen.tsx` | Atualizar handleDownloadAll para Worker URL |
| `src/components/DownloadModal.tsx` | Sem mudanca (ja usa originalPath corretamente) |

### Arquivos que sao REMOVIDOS

| Arquivo | Razao |
|---------|-------|
| `supabase/functions/b2-upload/index.ts` | Substituido por upload via Worker R2 |
| `supabase/functions/b2-download-url/index.ts` | Substituido por rota /download no Worker |

### Arquivos que NAO mudam

| Arquivo | Razao |
|---------|-------|
| `supabase/functions/r2-upload/index.ts` | Continua como esta (upload de previews) |
| `supabase/functions/delete-photos/index.ts` | Precisa adaptar para deletar do R2 em vez de B2 |
| `supabase/functions/gallery-access/index.ts` | Sem mudanca (ja retorna galleryId) |
| `src/lib/photoUrl.ts` | Sem mudanca (ja aponta para R2) |
| `src/types/gallery.ts` | Sem mudanca (originalPath continua existindo) |

## Secao Tecnica: Novo Fluxo

### Upload de Originais (quando allowDownload=true)

```text
ANTES:
PhotoUploader --> supabase.functions.invoke('b2-upload') --> Backblaze B2 API
                  (Edge Function com auth B2, retry, cache)

DEPOIS:
PhotoUploader --> fetch('https://cdn.lunarihub.com/upload-original', formData)
                  --> Worker R2 --> GALLERY_BUCKET.put('originals/{galleryId}/{file}')
```

Mudancas no Worker:
- Nova rota `POST /upload-original` para arquivos originais (sem compressao)
- Path separado: `originals/{galleryId}/{filename}` (para diferenciar de previews em `galleries/`)
- Mesma autenticacao JWT ja existente
- Retorna o path salvo para gravar em `original_path` no banco

### Download de Originais

```text
ANTES:
Frontend --> Edge Function b2-download-url (gera signed URLs) --> Frontend --> B2 direto (FALHA)

DEPOIS:
Frontend --> window.location.href = 'https://cdn.lunarihub.com/download/originals/{galleryId}/{file}?filename=nome.jpg'
         --> Worker le do R2, retorna com Content-Disposition: attachment
```

Mudancas no Worker:
- Nova rota `GET /download/{path}` 
- Le arquivo do R2 via `GALLERY_BUCKET.get(path)`
- Retorna com headers:
  - `Content-Disposition: attachment; filename="nome_original.jpg"`
  - `Content-Type: image/jpeg`
  - `Cache-Control: private, no-cache`
- Streaming nativo (nao carrega tudo na memoria)
- **Sem autenticacao complexa** - a seguranca e por obscuridade do path (UUID no galleryId + UUID no filename)

### Delecao de Fotos

O `delete-photos` Edge Function precisa ser adaptado:
- Em vez de chamar B2 API para deletar, chama o Worker R2
- Ou melhor: usa a API S3 do R2 diretamente (ja temos R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY como secrets)
- Deleta tanto o preview (`galleries/{id}/{file}`) quanto o original (`originals/{id}/{file}`)

## Custos e Limites

| Recurso | Cloudflare R2 (Free Tier) |
|---------|--------------------------|
| Armazenamento | 10 GB gratis, depois $0.015/GB/mes |
| Operacoes PUT | 1M gratis/mes |
| Operacoes GET | 10M gratis/mes |
| Egress (saida) | **GRATIS** (sempre, sem limite) |
| Workers | 100k requests/dia (free), 10M/mes ($5/mes) |

Comparacao com B2:
- B2 egress: gratis via Cloudflare (Bandwidth Alliance)
- R2 egress: **sempre gratis** independente de rota
- Complexidade B2: auth, signed URLs, tokens, cache --> **eliminada**

## Plano de Execucao (ordem)

### Passo 1: Adicionar rotas ao Worker

Adicionar ao `cloudflare/workers/gallery-upload/index.ts`:

1. `POST /upload-original` - Recebe arquivo original, salva em `originals/{galleryId}/{filename}`
2. `GET /download/{path}` - Serve arquivo com `Content-Disposition: attachment`

### Passo 2: Atualizar PhotoUploader

Modificar `src/components/PhotoUploader.tsx`:
- Trocar chamada `supabase.functions.invoke('b2-upload')` por `fetch('https://cdn.lunarihub.com/upload-original', formData)`
- Manter mesma logica de "upload original ANTES da compressao"
- O path retornado sera algo como `originals/{galleryId}/{timestamp}-{uuid}.jpg`
- Esse path e gravado em `original_path` via R2 upload (que ja faz o insert no banco)

### Passo 3: Reescrever downloadUtils

Simplificar `src/lib/downloadUtils.ts`:
- Remover toda logica de Edge Function `b2-download-url`
- `downloadPhoto()`: `window.location.href = workerDownloadUrl`
- `downloadAllPhotos()`: downloads sequenciais com mesma URL pattern

### Passo 4: Atualizar Lightbox e FinalizedPreviewScreen

- Lightbox `handleDownload`: usar nova URL direta do Worker
- FinalizedPreviewScreen `handleDownloadAll`: usar nova funcao simplificada

### Passo 5: Adaptar delete-photos

- Usar R2 S3 API (com credenciais ja existentes) para deletar arquivos
- Deletar tanto `galleries/{id}/{file}` (preview) quanto `originals/{id}/{file}` (original)

### Passo 6: Remover B2

- Deletar `supabase/functions/b2-upload/index.ts`
- Deletar `supabase/functions/b2-download-url/index.ts`
- Secrets B2 podem ser removidos depois (B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_ID, B2_BUCKET_NAME)

## Nota sobre Deploy

O Cloudflare Worker precisa ser deployado **manualmente** pelo usuario:

1. Apos as mudancas no codigo, rodar `wrangler deploy` no diretorio `cloudflare/workers/gallery-upload/`
2. Nao precisa de novos secrets (Worker ja tem binding R2 configurado)
3. As Edge Functions deletadas serao removidas automaticamente pelo Lovable

## Dependencias Externas Apos Migracao

| Servico | Uso | Risco |
|---------|-----|-------|
| Cloudflare R2 | Storage unico (previews + originais) | Baixo - infraestrutura madura |
| Cloudflare Workers | Upload, serve, download | Baixo - mesmo provedor |
| Supabase | Auth, banco de dados, Edge Functions | Medio - ja em uso |

**Zero dependencia de B2/Backblaze.** Tudo em um unico provedor de storage (Cloudflare).

