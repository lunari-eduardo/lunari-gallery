

## Plano: Corrigir créditos de assinaturas existentes + Downgrade CORS

### Problema 1: Créditos não concedidos em assinaturas anteriores

O `asaas-upgrade-subscription` foi corrigido para conceder créditos no upgrade, mas assinaturas criadas via `asaas-create-subscription` JÁ tinham essa lógica (linha 229-233). O problema é que o usuário mencionado fez upgrade de planos existentes (Studio + Transfer → combo_completo), e o upgrade antigo NÃO tinha o `renew_subscription_credits`. A correção já foi deployada, mas as assinaturas criadas ANTES da correção ficaram sem créditos.

**Solução**: Migração SQL para conceder 2000 `credits_subscription` a todos os usuários com assinatura ativa de combo que têm `credits_subscription = 0`.

```sql
UPDATE photographer_accounts pa
SET credits_subscription = 2000, updated_at = now()
WHERE credits_subscription = 0
  AND EXISTS (
    SELECT 1 FROM subscriptions_asaas sa
    WHERE sa.user_id = pa.user_id
      AND sa.plan_type IN ('combo_pro_select2k', 'combo_completo')
      AND sa.status IN ('ACTIVE', 'PENDING', 'OVERDUE')
  );
```

Também inserir registro no `credit_ledger` para auditoria.

### Problema 2: CORS error no downgrade mensal

O screenshot mostra CORS error ao chamar `asaas-downgrade-subscription`. A função tem CORS headers corretos e está no `config.toml`. Os logs mostram que ela funciona para outros downgrades (combo_completo → transfer_20gb). O erro de CORS geralmente indica que o isolate do Deno crashou antes de responder (cold start timeout).

**Solução**: Redesplegar a edge function `asaas-downgrade-subscription` para forçar recriação do isolate. Não há bug de código — a lógica de validação (`newMonthly < currentMonthly`) permite corretamente transfer_5gb (1290) < combo_completo (6490).

### Problema 3: Verificar todos os cenários de downgrade

Cenários possíveis e validação:
- combo_completo (6490) → qualquer transfer solo ✓ (1290-5990 < 6490)
- combo_completo (6490) → combo_pro_select2k (4490) ✓ (4490 < 6490)
- combo_completo (6490) → studio_pro (3590) ✓ — **MAS** a UI não mostra studio cards na aba Transfer
- combo_pro_select2k (4490) → studio_pro (3590) ✓
- combo_pro_select2k (4490) → transfer solo ✓
- transfer_100gb (5990) → transfer_50gb/20gb/5gb ✓

**Problema identificado**: Quando o usuário tem combo_completo e quer fazer downgrade para um plano studio (sem transfer), a UI na aba Select não oferece "Agendar downgrade" para studio_pro/studio_starter. Preciso verificar e corrigir se necessário.

### Arquivos a modificar

1. **Migração SQL** — conceder créditos a assinantes combo existentes
2. **Redeploy** `asaas-downgrade-subscription` — forçar recriação do isolate
3. **`src/pages/CreditsCheckout.tsx`** — verificar se aba Select oferece downgrade para combos → studio

