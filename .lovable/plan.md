

## Diagnóstico: Erro 500 no `confirm-selection`

### Causa raiz

O erro nos logs é claro:

```
new row for relation "galerias" violates check constraint "galerias_status_selecao_check"
```

A constraint `galerias_status_selecao_check` só aceita estes valores:
- `em_andamento`, `selecao_completa`, `bloqueado`, `aguardando_pagamento`

A RPC `try_lock_gallery_selection` (criada na alteração anterior) tenta setar `status_selecao = 'processando_selecao'`, que **não está na lista permitida**. Resultado: erro PostgreSQL → 500 na Edge Function → pagamento falha.

O valor `selecao_iniciada` também está sendo usado no sistema (aparece no log do erro) mas não consta na constraint. Precisa ser adicionado também.

### Correção

**1. Nova migration SQL** — Alterar a CHECK constraint:

```sql
ALTER TABLE public.galerias DROP CONSTRAINT IF EXISTS galerias_status_selecao_check;

ALTER TABLE public.galerias ADD CONSTRAINT galerias_status_selecao_check 
  CHECK (status_selecao = ANY (ARRAY[
    'em_andamento', 
    'selecao_iniciada',
    'processando_selecao',
    'selecao_completa', 
    'bloqueado', 
    'aguardando_pagamento'
  ]));
```

Nenhuma alteração em Edge Functions é necessária. É apenas a constraint do banco que está desatualizada em relação ao novo status transitório.

### Arquivos modificados
- 1 nova migration SQL (constraint fix)

