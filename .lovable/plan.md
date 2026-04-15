

# Fix: Inconsistências críticas no ciclo de reabertura de seleção e pagamento

## Problemas identificados (análise do banco de dados)

**Galeria Aurora - Newborn (1bca90ca)**:
- 1ª confirmação (18:30): servidor contou 12 fotos selecionadas (frontend enviou 14). Cobrou 2 extras → R$50 via InfinitePay → **pago**
- Reabertura (18:38): fotógrafo reabriu seleção
- 2ª confirmação (19:06): servidor contou 14 fotos. Cobrou 2 extras → R$42 via InfinitePay → **pendente** (nunca pago)
- Estado atual: `total_fotos_extras_vendidas=4`, `valor_total_vendido=100` — **ERRADO**, deveria ser 2 e 50

### Causa raiz 1: Auto-heal reutiliza cobrança antiga

Quando o cliente acessa a galeria após a 2ª confirmação (`status_selecao='aguardando_pagamento'`), o `gallery-access` procura cobranças com status `pago`/`pago_manual`:

```sql
.in("status", ["pago", "pago_manual"])
```

Encontra a **primeira cobrança** (R$50, já paga no ciclo anterior). Chama `finalize_gallery_payment` que:
1. **Soma os valores novamente** (+=) à galeria: `total_fotos_extras_vendidas += 2` (era 2, vira 4)
2. **Marca galeria como finalizada** prematuramente (`status_selecao='selecao_completa'`, `finalized_at` set)
3. A 2ª cobrança (R$42) fica pendente para sempre
4. Painel do fotógrafo mostra R$100 pago, mas só R$50 foi efetivamente pago

### Causa raiz 2: Reabertura não cancela cobranças pendentes anteriores nem reseta status de pagamento

O `reopenSelectionMutation` reseta `status`, `status_selecao`, `finalized_at` mas:
- **Não reseta `status_pagamento`** (fica como `pago` do ciclo anterior)
- **Não cancela cobranças pendentes** de ciclos anteriores

### Causa raiz 3: Seleções perdidas (12 de 14)

O `selectionMutation` usa `useMutation` sem fila — múltiplos toggles rápidos disparam requisições paralelas que podem colidir ou falhar silenciosamente. O `onError` mostra um toast mas **não reverte** o estado otimista corretamente (faz `invalidateQueries` que pode não refletir o estado real se a foto nunca foi persistida).

### Causa raiz 4: "Galeria não encontrada" após reabertura

Provavelmente causado pelo auto-heal que finaliza prematuramente a galeria. Quando o cliente volta ao link após a finalização espúria, o frontend mostra a tela de "finalized" — mas se houve algum timing issue ou o token teve problemas, aparece "não encontrada".

## Plano de correção

### 1. `gallery-access` — Auto-heal com filtro temporal (Edge Function)

Na seção de auto-heal (linhas 195-232), ao buscar cobranças pagas, **verificar se existe cobrança pendente mais recente**. Se sim, a cobrança paga é de um ciclo anterior e não deve disparar auto-heal.

```typescript
// Antes do auto-heal, verificar se há cobrança pendente mais nova
const { data: newerPending } = await supabase
  .from("cobrancas")
  .select("id")
  .eq("galeria_id", gallery.id)
  .eq("status", "pendente")
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

// Se existe cobrança pendente mais recente que a paga, NÃO auto-heal
if (newerPending) {
  // Pular auto-heal — pagamento pendente é do ciclo atual
}
```

Aplicar o mesmo filtro na seção de recovery (linhas 385-527).

### 2. `finalize_gallery_payment` RPC — Idempotência por cobrança (Migração SQL)

Adicionar coluna `gallery_synced_at` na tabela `cobrancas`. O RPC verifica se já sincronizou antes de somar valores:

```sql
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS gallery_synced_at timestamptz;

-- Na RPC, antes de atualizar galeria:
IF v_cobranca.gallery_synced_at IS NOT NULL THEN
  -- Já sincronizado, não somar novamente
  RETURN ...;
END IF;

-- Após sincronizar, marcar:
UPDATE cobrancas SET gallery_synced_at = now() WHERE id = p_cobranca_id;
```

### 3. Reabertura de seleção — Reset completo (Frontend)

No `reopenSelectionMutation` (`useSupabaseGalleries.ts`):

- **Resetar `status_pagamento`** para `'sem_vendas'`
- **Cancelar cobranças pendentes** do ciclo anterior:
  ```typescript
  await supabase.from('cobrancas')
    .update({ status: 'cancelada', updated_at: new Date().toISOString() })
    .eq('galeria_id', id)
    .eq('status', 'pendente');
  ```

### 4. Seleção resiliente — Fila de mutações (Frontend)

No `ClientGallery.tsx`, trocar `useMutation` simples por uma abordagem com **retry automático e fila sequencial**:

- Usar `retry: 2` na configuração do mutation
- No `onError`, **reverter o estado otimista** para o valor anterior (em vez de invalidar queries inteiro)
- Adicionar debounce visual para feedback

### 5. Correção manual do dado atual (Migração SQL)

Corrigir a galeria Aurora - Newborn para refletir o valor real pago:

```sql
UPDATE galerias
SET total_fotos_extras_vendidas = 2, 
    valor_total_vendido = 50
WHERE id = '1bca90ca-feb8-45f6-a1ad-3dbf6c7fdd1e';

UPDATE cobrancas
SET status = 'cancelada'
WHERE id = '079bc3d4-1594-49c3-8820-7b82a2c8589a';
```

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/gallery-access/index.ts` | Auto-heal com filtro de cobrança pendente mais recente |
| `supabase/migrations/new_migration.sql` | Coluna `gallery_synced_at`, RPC atualizada, fix dados |
| `src/hooks/useSupabaseGalleries.ts` | Reabertura reseta status_pagamento e cancela pendentes |
| `src/pages/ClientGallery.tsx` | Mutation com retry:2 e rollback otimista correto |

