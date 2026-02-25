

# Correção: Armazenamento Transfer contabilizando preview em vez de original

## Diagnóstico

A função RPC `get_transfer_storage_bytes` soma `galeria_fotos.file_size`. Porém, o campo `file_size` armazena o tamanho do **preview comprimido** (enviado via `POST /upload`), não do arquivo original de alta resolução (enviado via `POST /upload-original`).

O Worker `/upload-original` **não cria registro no banco** — apenas salva no R2 e retorna o `storageKey`. O Worker `/upload` é quem insere o registro em `galeria_fotos`, usando `fileBuffer.byteLength` do preview comprimido (~200KB-500KB por foto em vez de ~1MB-3MB do original).

Por isso 140MB reais aparecem como 29MB: está somando apenas os previews.

## Solução

Adicionar coluna `original_file_size` à tabela `galeria_fotos` e populá-la durante o upload. Atualizar a RPC para usar esse valor nas galerias Transfer.

## Mudanças

### 1. Nova migration SQL

```sql
-- Adicionar coluna para tamanho do original
ALTER TABLE public.galeria_fotos 
  ADD COLUMN IF NOT EXISTS original_file_size BIGINT;

-- Atualizar RPC para usar original_file_size em galerias Transfer
CREATE OR REPLACE FUNCTION public.get_transfer_storage_bytes(_user_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(SUM(
    CASE 
      WHEN gf.original_file_size IS NOT NULL THEN gf.original_file_size
      ELSE gf.file_size
    END
  ), 0)::BIGINT
  FROM public.galeria_fotos gf
  INNER JOIN public.galerias g ON g.id = gf.galeria_id
  WHERE g.user_id = _user_id
    AND g.tipo = 'entrega'
    AND g.status NOT IN ('excluida');
$$;
```

A RPC usa `original_file_size` quando disponível, com fallback para `file_size` (compatibilidade com fotos já existentes).

### 2. `cloudflare/workers/gallery-upload/index.ts` — Gravar `original_file_size` no DB

No handler `handleUpload`, quando receber o campo `originalFileSize` no FormData (enviado pelo pipeline), incluí-lo no registro do banco:
- Ler `originalFileSize` do FormData
- Adicionar `original_file_size: parseInt(originalFileSize)` ao `photoRecord`

No handler `handleUploadOriginal`, retornar `fileSize` na resposta (já faz isso).

### 3. `src/lib/uploadPipeline.ts` — Enviar tamanho do original no upload do preview

No método `uploadPreview`, adicionar ao FormData o tamanho original do arquivo:
- `formData.append('originalFileSize', item.file.size.toString())`

Isso usa `item.file.size` que é o `File` original selecionado pelo usuário, antes da compressão.

### 4. Backfill de dados existentes (opcional, via SQL manual)

Para galerias Transfer já existentes, os originais estão no R2 mas sem `original_file_size` no banco. A RPC fará fallback para `file_size` nesses casos. Para corrigir dados históricos, seria necessário um script que consulte os tamanhos dos objetos no R2 — isso pode ser feito manualmente depois.

## Arquivos

| Arquivo | Ação |
|---|---|
| Nova migration SQL | Adicionar coluna `original_file_size` e atualizar RPC |
| `cloudflare/workers/gallery-upload/index.ts` | Ler e gravar `originalFileSize` no registro |
| `src/lib/uploadPipeline.ts` | Enviar `item.file.size` como `originalFileSize` no FormData |

