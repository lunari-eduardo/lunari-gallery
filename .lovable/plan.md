

# Plano: Robustez do Upload em Escala

## Analise da Causa Raiz

O erro 500 vem da Edge Function `r2-upload`. Existem 3 pontos de falha possiveis:

1. **R2 upload via S3 API** (linha 274) - timeout ou erro transiente na conexao com Cloudflare R2
2. **DB insert** (linha 287) - falha ao salvar metadados no Supabase
3. **Edge Function timeout** (~60s) - sob carga alta, a funcao pode estourar o tempo

## Problemas Criticos Encontrados

### 1. Creditos consumidos antes do upload (BUG GRAVE)

```text
Fluxo atual:
  consume_photo_credits() --> OK, credito debitado
  uploadToR2()            --> FALHA (500)
  Resultado: credito perdido, foto nao salva
```

Na linha 229, `consume_photo_credits` e chamado ANTES do upload para R2 (linha 274). Se o R2 falhar, o credito ja foi consumido e nao e devolvido.

Pior: o `retryWithBackoff` no frontend (linha 206) re-invoca a Edge Function inteira, consumindo OUTRO credito em cada tentativa. Com 3 tentativas, 1 falha pode consumir ate 3 creditos.

### 2. Sem retry server-side para R2

A Edge Function faz uma unica tentativa de upload para R2. Se falhar (timeout, rede), retorna 500 imediatamente. O retry acontece no frontend, mas re-executa tudo (auth, creditos, upload).

### 3. Sem idempotencia

Nao ha mecanismo para evitar duplicatas. Se o upload no R2 foi bem-sucedido mas o DB insert falhou, o retry do frontend cria um novo arquivo no R2 (com nome diferente) e tenta inserir de novo, deixando o arquivo orfao no R2.

### 4. Sem auto-retry para fotos com erro

Apos o batch completar, fotos com erro ficam paradas. O usuario precisa clicar "Tentar novamente" manualmente em cada uma. Para uploads de centenas de fotos, isso e inviavel.

## Plano de Correcao

### Mudanca 1: Retry server-side no R2 (Edge Function)

Adicionar retry com backoff dentro da Edge Function para o upload R2, antes de retornar 500:

```text
Edge Function r2-upload:
  uploadToR2() --> falha --> retry 1 (1s) --> retry 2 (2s) --> so entao retorna 500
```

Isso resolve a maioria dos erros transientes sem precisar re-executar auth/creditos.

**Arquivo**: `supabase/functions/r2-upload/index.ts`

### Mudanca 2: Mover consumo de creditos para DEPOIS do upload

Reordenar o fluxo na Edge Function:

```text
ANTES (errado):
  1. Auth
  2. Verificar creditos + CONSUMIR
  3. Upload R2 (pode falhar)
  4. Insert DB

DEPOIS (correto):
  1. Auth
  2. Verificar creditos (apenas checar, sem consumir)
  3. Upload R2
  4. Insert DB
  5. CONSUMIR creditos (so apos sucesso total)
```

Isso requer criar uma nova RPC `check_photo_credits` que apenas verifica se ha creditos sem consumir, e mover `consume_photo_credits` para apos o insert no DB.

**Arquivos**: `supabase/functions/r2-upload/index.ts` + migracao SQL para nova RPC

### Mudanca 3: Auto-retry de fotos com erro no frontend

Apos o batch completar, automaticamente re-tentar fotos com erro (ate 2 vezes) com delay progressivo:

```text
Batch completo --> 3 fotos com erro --> espera 5s --> retry automatico --> 1 ainda com erro --> espera 10s --> retry final
```

**Arquivo**: `src/components/PhotoUploader.tsx`

### Mudanca 4: Idempotencia via upload_key

Gerar um `upload_key` unico no frontend (hash do galleryId + originalFilename + fileSize) e enviar na requisicao. A Edge Function verifica se ja existe uma foto com esse `upload_key` no banco antes de inserir. Se existir, retorna a foto existente em vez de duplicar.

```text
Frontend gera: upload_key = hash(galleryId + filename + size)
Edge Function: SELECT * FROM galeria_fotos WHERE upload_key = ? AND galeria_id = ?
  Se existe --> retorna foto existente (sucesso)
  Se nao --> faz upload normal
```

**Arquivos**: `supabase/functions/r2-upload/index.ts`, `src/components/PhotoUploader.tsx`, migracao SQL para coluna `upload_key`

### Mudanca 5: Refresh de token antes do batch

Antes de iniciar o batch de uploads, forcar refresh do token Supabase. Tokens expiram em 1 hora; uploads grandes podem demorar mais.

**Arquivo**: `src/components/PhotoUploader.tsx`

## Resumo de Arquivos

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/r2-upload/index.ts` | Retry server-side R2, reordenar creditos, idempotencia |
| `src/components/PhotoUploader.tsx` | Auto-retry, upload_key, token refresh |
| `src/lib/retryFetch.ts` | Sem mudancas (ja esta bom) |
| Migracao SQL | Nova RPC `check_photo_credits`, coluna `upload_key` |

## Prioridade de Implementacao

1. **Mudanca 2** (creditos) - mais critico, usuarios perdem creditos
2. **Mudanca 1** (retry server-side) - resolve maioria dos 500 transientes
3. **Mudanca 3** (auto-retry) - melhora UX para uploads grandes
4. **Mudanca 4** (idempotencia) - previne duplicatas
5. **Mudanca 5** (token refresh) - previne falhas em batches longos

