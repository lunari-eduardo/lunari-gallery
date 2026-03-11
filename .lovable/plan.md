

## Plano: Correção de Race Conditions e Controle de Concorrência

### Problema 1: Execução concorrente em `confirm-selection`

A Edge Function `confirm-selection` não tem proteção contra execução concorrente. Se o cliente clicar duas vezes rapidamente no botão de confirmar:
- Duas requisições leem a galeria com `status_selecao = 'em_andamento'`
- Ambas passam na validação da linha 198
- Ambas criam links de pagamento (cobrança duplicada)
- Ambas atualizam a galeria

**Solução**: Criar uma RPC `try_lock_gallery_selection` que atomicamente:
1. Faz `SELECT ... FOR UPDATE` na galeria
2. Verifica se `status_selecao` ainda permite confirmação
3. Se sim, marca como `'processando_selecao'` (estado transitório) e retorna os dados da galeria
4. Se não (já em processamento ou completa), retorna `{ locked: false }`

A Edge Function chama esta RPC no início. Se retornar `locked: false`, retorna erro 409 (Conflict). Caso contrário, prossegue normalmente com os dados da galeria retornados pela RPC.

### Problema 2: Read-then-write na sessão (confirm-selection)

Linhas 589-590 calculam novos totais baseados em valores lidos no início da função (linha 183), que podem estar defasados:
```typescript
const novoQtdFotosExtra = (gallery.total_fotos_extras_vendidas || 0) + extrasACobrar;
```

**Solução**: Substituir por UPDATE com incremento atômico direto:
```sql
UPDATE clientes_sessoes SET
  qtd_fotos_extra = COALESCE(qtd_fotos_extra, 0) + $extras,
  valor_total_foto_extra = COALESCE(valor_total_foto_extra, 0) + $valor
WHERE session_id = $session_id
```

### Problema 3: Dupla escrita em check-payment-status

Linhas 299-310 fazem `UPDATE cobrancas` manualmente antes de chamar `finalize_gallery_payment`, que também atualiza `cobrancas`. Os campos `ip_transaction_nsu` e `ip_receipt_url` são salvos fora da RPC.

**Solução**: Mover a escrita de `ip_transaction_nsu` para ANTES da RPC (já é feito), mas remover o `status: 'pago'` e `data_pagamento` do UPDATE manual (linhas 299-302) pois a RPC já faz isso. Assim evita-se a dupla escrita do status.

### Arquivos modificados

1. **Nova migration SQL** — cria RPC `try_lock_gallery_selection(p_gallery_id UUID)` 
2. **`supabase/functions/confirm-selection/index.ts`**:
   - Substituir leitura manual da galeria (linhas 183-195) pela chamada à RPC de lock
   - Substituir update da sessão (linhas 592-601) por incremento atômico
3. **`supabase/functions/check-payment-status/index.ts`**:
   - Remover `status: 'pago'` e `data_pagamento` do UPDATE manual (linhas 299-302)

### Detalhes da RPC `try_lock_gallery_selection`

```text
Recebe: p_gallery_id UUID
Retorna: JSONB

1. pg_advisory_xact_lock(hashtext(p_gallery_id::text))
2. SELECT * FROM galerias WHERE id = p_gallery_id FOR UPDATE
3. Se status_selecao IN ('selecao_completa', 'processando_selecao', 'aguardando_pagamento')
   → retorna { locked: false, reason: 'already_processing' }
4. Se finalized_at IS NOT NULL
   → retorna { locked: false, reason: 'already_finalized' }
5. UPDATE galerias SET status_selecao = 'processando_selecao' WHERE id = p_gallery_id
6. Retorna { locked: true, gallery: row_to_json(gallery) }
```

O status `processando_selecao` é transitório — a função `confirm-selection` o substitui por `aguardando_pagamento` ou `selecao_completa` ao final. Se a Edge Function falhar, um cleanup pode resetar galerias presas neste estado.

