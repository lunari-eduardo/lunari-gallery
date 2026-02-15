

# Correcao: Adicionar `aguardando_pagamento` ao check constraint da tabela `galerias`

## Causa raiz

A Edge Function `confirm-selection` tenta definir `status_selecao = 'aguardando_pagamento'`, mas a coluna `status_selecao` possui um CHECK constraint que so aceita tres valores: `em_andamento`, `confirmado`, `bloqueado`.

O erro retornado e:
```
new row for relation "galerias" violates check constraint "galerias_status_selecao_check"
```

## Correcao

Executar uma migration SQL para atualizar o CHECK constraint, adicionando o valor `aguardando_pagamento`:

```sql
ALTER TABLE galerias DROP CONSTRAINT galerias_status_selecao_check;
ALTER TABLE galerias ADD CONSTRAINT galerias_status_selecao_check 
  CHECK (status_selecao = ANY (ARRAY['em_andamento', 'confirmado', 'bloqueado', 'aguardando_pagamento']));
```

Nenhuma mudanca de codigo e necessaria -- a logica nas Edge Functions ja esta correta, apenas o banco nao aceita o novo valor.

## Arquivo

| Arquivo | Mudanca |
|---------|---------|
| Nova migration SQL | Adicionar `aguardando_pagamento` ao check constraint |

