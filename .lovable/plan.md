

# Exclusao completa de galerias: banco + R2

## Problema atual

Ao excluir uma galeria, o `delete-photos` Edge Function deleta apenas dois caminhos por foto no R2:
- `storage_key` (preview principal)
- `original_path` (original sem marca d'agua)

Mas cada foto pode ter ate **5 caminhos distintos** no R2:

| Coluna | Exemplo | Deletado hoje? |
|--------|---------|:-:|
| `storage_key` | `galleries/id/xxx.jpg` | Sim |
| `original_path` | `originals/id/xxx.jpg` | Sim |
| `preview_path` | `galleries/id/yyy.jpg` | Nao |
| `preview_wm_path` | `galleries/id/wm-zzz.jpg` | Nao |
| `thumb_path` | `galleries/id/ttt.jpg` | Nao |

Na pratica, `preview_path` e `thumb_path` costumam ser iguais a `storage_key`, mas isso nao e garantido. E `preview_wm_path` pode ser um arquivo separado.

Alem disso, a query no frontend usa `select('id')` e nao pagina -- se a galeria tiver mais de 1000 fotos, o Supabase corta silenciosamente e fotos ficam orfas.

## Solucao

### 1. Edge Function `delete-photos` -- deletar TODOS os caminhos

Alterar o `select` para incluir todos os campos de path:

```
select: "id, storage_key, original_path, preview_path, preview_wm_path, thumb_path"
```

E na logica de exclusao, coletar todos os paths unicos (sem duplicatas) e deletar cada um:

```text
Para cada foto:
  paths unicos = Set de [storage_key, original_path, preview_path, preview_wm_path, thumb_path]
  remover nulls e duplicatas
  deletar cada path do R2
```

### 2. Frontend `useSupabaseGalleries.ts` -- paginar a busca de fotos

Se a galeria tiver mais de 1000 fotos, a query atual perde registros. Solucao: buscar em loop ate nao ter mais resultados, ou usar `count` e paginar.

Simplificacao: como ja estamos passando os IDs para o Edge Function, podemos enviar em batches de 500.

### 3. `credit_ledger` FK -- tratar antes de deletar galeria

A FK `credit_ledger_gallery_id_fkey` tem `ON DELETE NO ACTION`. Isso pode bloquear a exclusao da galeria se houver registros no ledger. Solucao: setar `gallery_id = NULL` nos registros de `credit_ledger` antes de deletar (manter historico de creditos, so desvincular da galeria).

## Arquivos

| Arquivo | Acao |
|---------|------|
| `supabase/functions/delete-photos/index.ts` | Buscar e deletar todos os 5 campos de path, eliminando duplicatas |
| `src/hooks/useSupabaseGalleries.ts` | Paginar busca de fotos; desvincular `credit_ledger` antes de deletar |

## Secao tecnica

### delete-photos/index.ts

Mudanca no select:
```text
ANTES: select("id, storage_key, original_path")
DEPOIS: select("id, storage_key, original_path, preview_path, preview_wm_path, thumb_path")
```

Mudanca na logica de exclusao R2:
```text
ANTES:
  if storage_key → deleteFromR2(storage_key)
  if original_path != storage_key → deleteFromR2(original_path)

DEPOIS:
  paths = new Set()
  for field in [storage_key, original_path, preview_path, preview_wm_path, thumb_path]:
    if field != null → paths.add(field)
  for path in paths:
    deleteFromR2(path)
```

### useSupabaseGalleries.ts - deleteGalleryMutation

```text
ANTES:
  select('id') → pega ate 1000
  envia todos os IDs de uma vez

DEPOIS:
  Loop paginado: select('id').range(offset, offset+999)
  Envia em batches de 500 para o Edge Function
  Apos fotos, limpa credit_ledger:
    supabase.from('credit_ledger').update({ gallery_id: null }).eq('gallery_id', id)
  Entao deleta galeria (cascade cuida de galeria_fotos, galeria_acoes, cobrancas)
```

### Cascatas ja configuradas (sem mudanca necessaria)

- `galeria_fotos` → ON DELETE CASCADE
- `galeria_acoes` → ON DELETE CASCADE
- `cobrancas` → ON DELETE CASCADE
- `clientes_sessoes` → Tratado manualmente no codigo (set `galeria_id = null`)

