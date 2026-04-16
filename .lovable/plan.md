

# Fix: Galerias públicas não aceitam pagamento — `try_lock_visitor_selection` crash

## Problema

A RPC `try_lock_visitor_selection` gera erro `"−" is not a valid hexadecimal digit` ao tentar converter o UUID do visitante para um advisory lock. A linha problemática:

```sql
pg_try_advisory_xact_lock(('x' || substr(v_visitor.id::text, 1, 16))::bit(64)::bigint)
```

UUIDs têm hyphens na posição 9 (`a1b2c3d4-e5f6-78...`), e hyphens não são dígitos hexadecimais válidos. O cast para `bit(64)` falha, causando o erro 500 que o frontend mostra como "Erro ao processar seleção".

## Solução

Usar `hashtext()` (mesmo padrão já usado em `try_lock_gallery_selection`) em vez do cast hex manual:

```sql
-- DE (quebrado):
v_lock_acquired := pg_try_advisory_xact_lock(('x' || substr(v_visitor.id::text, 1, 16))::bit(64)::bigint);

-- PARA (funcional):
v_lock_acquired := pg_try_advisory_xact_lock(hashtext('visitor_selection_' || p_visitor_id::text));
```

## Implementação

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/...fix_visitor_lock.sql` | `CREATE OR REPLACE FUNCTION try_lock_visitor_selection` corrigindo a linha do advisory lock |

A migração recria a função com a mesma lógica, alterando apenas a linha 104 do lock para usar `hashtext()`.

Nenhuma alteração de frontend ou outras Edge Functions necessária — o erro é exclusivamente nessa RPC.

