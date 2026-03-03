

## Plano: Corrigir estorno de créditos ao excluir foto no upload

### Problema

1. **Estorno no bucket errado**: `handleDeleteUploadedPhoto` (GalleryCreate.tsx:201-216) sempre incrementa `photo_credits` (avulsos), mas o consumo via `consume_photo_credits` debita `credits_subscription` primeiro. Resultado: créditos de assinatura são consumidos mas nunca devolvidos; créditos avulsos inflam artificialmente.

2. **Cache stale**: `refetchCredits()` é chamado no hook de GalleryCreate, mas o `PhotoUploader` tem sua própria instância de `usePhotoCredits()` com `staleTime: 10s`. O número exibido ("X créditos disponíveis") não atualiza imediatamente. Precisa usar `queryClient.invalidateQueries` para forçar refetch em todas as instâncias.

### Solução

**A) Criar RPC `refund_photo_credit` no banco** (nova migração SQL)

```sql
CREATE OR REPLACE FUNCTION refund_photo_credit(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  sub_balance INTEGER;
  sub_cap INTEGER;
BEGIN
  SELECT COALESCE(credits_subscription, 0)
  INTO sub_balance
  FROM photographer_accounts
  WHERE user_id = _user_id FOR UPDATE;

  -- Determine subscription cap from active combo plan
  SELECT CASE sa.plan_type
    WHEN 'combo_pro_select2k' THEN 2000
    WHEN 'combo_completo' THEN 2000
    ELSE 0
  END INTO sub_cap
  FROM subscriptions_asaas sa
  WHERE sa.user_id = _user_id
    AND sa.status IN ('ACTIVE','PENDING','OVERDUE')
    AND sa.plan_type IN ('combo_pro_select2k','combo_completo')
  LIMIT 1;

  sub_cap := COALESCE(sub_cap, 0);

  -- Refund to subscription bucket if below cap, else to purchased
  IF sub_balance < sub_cap THEN
    UPDATE photographer_accounts
    SET credits_subscription = credits_subscription + 1,
        credits_consumed_total = GREATEST(0, COALESCE(credits_consumed_total,0) - 1),
        updated_at = NOW()
    WHERE user_id = _user_id;
  ELSE
    UPDATE photographer_accounts
    SET photo_credits = photo_credits + 1,
        credits_consumed_total = GREATEST(0, COALESCE(credits_consumed_total,0) - 1),
        updated_at = NOW()
    WHERE user_id = _user_id;
  END IF;
END;
$$;
```

Lógica: se `credits_subscription` está abaixo do teto do plano, o crédito foi originalmente consumido daí — devolve para lá. Caso contrário, devolve para `photo_credits`.

**B) Atualizar `handleDeleteUploadedPhoto` em GalleryCreate.tsx**

Substituir o bloco manual de UPDATE (linhas 202-216) por chamada ao RPC:
```typescript
await supabase.rpc('refund_photo_credit', { _user_id: user.id });
```

**C) Invalidar cache corretamente**

Substituir `refetchCredits()` por:
```typescript
queryClient.invalidateQueries({ queryKey: ['photo-credits'] });
```

Isso força refetch imediato em todas as instâncias (incluindo PhotoUploader).

### Arquivos modificados

1. **Nova migração SQL** — criar função `refund_photo_credit`
2. **`src/pages/GalleryCreate.tsx`** — usar RPC + invalidateQueries
3. **`src/integrations/supabase/types.ts`** — adicionar tipo da nova RPC

