
# Padronizacao de Status: `galerias.status_selecao` e `clientes_sessoes.status_galeria`

## Diagnostico atual

### Tabela `galerias` - coluna `status` (ciclo de vida principal)
| Valor atual no DB | Significado |
|---|---|
| `rascunho` | Galeria criada, nao publicada |
| `enviado` | Galeria publicada/enviada ao cliente |
| `selecao_iniciada` | Cliente acessou e comecou a selecionar |
| `selecao_completa` | Selecao finalizada (com ou sem pagamento) |

**Sem mudanca necessaria** - estes valores ja estao coerentes.

### Tabela `galerias` - coluna `status_selecao` (sub-estado da selecao)
| Valor atual | Constraint DB | Significado |
|---|---|---|
| `em_andamento` | Sim | Selecao em andamento |
| `confirmado` | Sim | Selecao confirmada/finalizada |
| `bloqueado` | Sim | Selecao bloqueada |
| `aguardando_pagamento` | Sim | Aguardando pagamento para finalizar |

**Problema**: `confirmado` deveria ser `selecao_completa` para alinhar com `galerias.status`.

### Tabela `clientes_sessoes` - coluna `status_galeria`
| Valor atual no DB | Onde e escrito | Significado |
|---|---|---|
| `criada` | `useSupabaseGalleries.ts` (criacao) | Galeria criada |
| `enviada` | `useSupabaseGalleries.ts` (publicacao) | Galeria enviada |
| `em_selecao` | `client-selection`, `confirm-selection` | Cliente selecionando |
| `selecao_iniciada` | legado (DB existente) | Mesmo que `em_selecao` |
| `selecao_completa` | legado (DB existente) | Selecao completa |
| `concluida` | webhooks, `confirm-selection`, `client-selection` | Selecao finalizada |
| `excluida` | `useSupabaseGalleries.ts` (exclusao) | Galeria excluida |

**Problema**: `concluida` e `selecao_completa` significam a mesma coisa. E `selecao_iniciada` vs `em_selecao` tambem.

---

## Padrao proposto

### `galerias.status_selecao` (4 valores)
| Novo valor | Antigo | Significado |
|---|---|---|
| `em_andamento` | `em_andamento` | Sem mudanca |
| `selecao_completa` | `confirmado` | **Renomear** - selecao finalizada |
| `bloqueado` | `bloqueado` | Sem mudanca |
| `aguardando_pagamento` | `aguardando_pagamento` | Sem mudanca |

### `clientes_sessoes.status_galeria` (5 valores + excluida)
| Novo valor | Antigos | Significado |
|---|---|---|
| `enviada` | `enviada`, `criada` | Galeria criada/publicada |
| `em_selecao` | `em_selecao`, `selecao_iniciada` | Cliente acessou e esta selecionando |
| `selecao_completa` | `concluida`, `selecao_completa` | Selecao finalizada |
| `expirada` | *(novo)* | Galeria expirada |
| `excluida` | `excluida` | Galeria removida |

---

## Mudancas necessarias

### 1. Migration SQL

```sql
-- 1. Atualizar dados existentes em galerias.status_selecao
UPDATE galerias SET status_selecao = 'selecao_completa' WHERE status_selecao = 'confirmado';

-- 2. Atualizar constraint
ALTER TABLE galerias DROP CONSTRAINT galerias_status_selecao_check;
ALTER TABLE galerias ADD CONSTRAINT galerias_status_selecao_check 
  CHECK (status_selecao = ANY (ARRAY[
    'em_andamento', 'selecao_completa', 'bloqueado', 'aguardando_pagamento'
  ]));

-- 3. Atualizar dados existentes em clientes_sessoes.status_galeria
UPDATE clientes_sessoes SET status_galeria = 'em_selecao' WHERE status_galeria = 'selecao_iniciada';
UPDATE clientes_sessoes SET status_galeria = 'selecao_completa' WHERE status_galeria = 'concluida';
UPDATE clientes_sessoes SET status_galeria = 'enviada' WHERE status_galeria = 'criada';

-- 4. Adicionar constraint em clientes_sessoes (nao tem nenhum hoje)
ALTER TABLE clientes_sessoes ADD CONSTRAINT sessoes_status_galeria_check 
  CHECK (status_galeria IS NULL OR status_galeria = ANY (ARRAY[
    'enviada', 'em_selecao', 'selecao_completa', 'expirada', 'excluida'
  ]));
```

### 2. Edge Functions (substituir `confirmado` por `selecao_completa` e `concluida` por `selecao_completa`)

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/confirm-selection/index.ts` | `'confirmado'` -> `'selecao_completa'`, `'concluida'` -> `'selecao_completa'` |
| `supabase/functions/gallery-access/index.ts` | `status_selecao === 'confirmado'` -> `'selecao_completa'` |
| `supabase/functions/infinitepay-webhook/index.ts` | `status_selecao: 'confirmado'` -> `'selecao_completa'`, `status_galeria: 'concluida'` -> `'selecao_completa'` |
| `supabase/functions/mercadopago-webhook/index.ts` | `status_selecao: 'confirmado'` -> `'selecao_completa'`, `status_galeria: 'concluida'` -> `'selecao_completa'` |
| `supabase/functions/check-payment-status/index.ts` | `status_selecao: 'confirmado'` -> `'selecao_completa'`, `status_galeria: 'concluida'` -> `'selecao_completa'` |
| `supabase/functions/client-selection/index.ts` | `status_selecao === 'confirmado'` -> `'selecao_completa'`, `status_galeria: 'concluida'` -> `'selecao_completa'` |

### 3. Frontend (substituir `confirmado` por `selecao_completa`)

| Arquivo | Mudanca |
|---|---|
| `src/pages/ClientGallery.tsx` | `=== 'confirmado'` -> `=== 'selecao_completa'` |
| `src/hooks/useSupabaseGalleries.ts` | `status_selecao: 'confirmado'` -> `'selecao_completa'`, `status_galeria: 'concluida'` nao existe aqui mas `status_galeria: 'criada'` -> `'enviada'` na criacao |
| `src/pages/GalleryDetail.tsx` | `statusSelecao === 'confirmado'` -> `'selecao_completa'` |
| `src/components/StatusBadge.tsx` | Adicionar `'selecao_completa'` ao mapeamento de selection status, remover `'confirmado'` |
| `src/pages/Dashboard.tsx` | `'confirmada'` -> `'selecao_completa'` no mapeamento de status |

### 4. Trigger `sync_gallery_status_to_session` (DB function)

Atualizar o mapeamento dentro da funcao para usar os novos termos (`selecao_completa` em vez de `concluida`).

---

## Resumo dos termos padronizados

```text
galerias.status:          rascunho -> enviado -> selecao_iniciada -> selecao_completa
galerias.status_selecao:  em_andamento -> aguardando_pagamento -> selecao_completa
clientes_sessoes.status_galeria:  enviada -> em_selecao -> selecao_completa | expirada | excluida
```
