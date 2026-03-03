

## Plano: Conceder créditos de assinatura no upgrade e corrigir variável undefined

### Problema raiz

A Edge Function `asaas-upgrade-subscription` (linha 393) finaliza o upgrade sem chamar `renew_subscription_credits`. Tanto `asaas-create-subscription` (linha 229-240) quanto o webhook `SUBSCRIPTION_RENEWED` (linha 311-321) fazem essa chamada, mas o fluxo de upgrade não.

Resultado: usuário contrata combo_completo via upgrade, recebe storage de 20GB mas `credits_subscription` permanece 0.

### Bug secundário

Linha 427 referencia `newSubData` que só existe no branch de assinatura recorrente (linha 347). No branch de pagamento parcelado (`useInstallmentPayment`), `newSubData` é `undefined` — causa erro silencioso na resposta.

### Correção em `supabase/functions/asaas-upgrade-subscription/index.ts`

**1. Adicionar mapa de créditos de assinatura (após PLANS, ~linha 22):**
```typescript
const PLAN_SUBSCRIPTION_CREDITS: Record<string, number> = {
  combo_pro_select2k: 2000,
  combo_completo: 2000,
};
```

**2. Após step 7 (reativação de galerias, ~linha 423), adicionar step 8:**
```typescript
// 8. Grant subscription credits if new plan includes them
const subCredits = PLAN_SUBSCRIPTION_CREDITS[newPlanType];
if (subCredits && subCredits > 0) {
  const { error: creditError } = await adminClient.rpc("renew_subscription_credits", {
    _user_id: userId,
    _amount: subCredits,
  });
  if (creditError) {
    console.error("Failed to grant subscription credits on upgrade:", creditError);
  } else {
    console.log(`Granted ${subCredits} subscription credits for upgrade to ${newPlanType}`);
  }
}
```

**3. Corrigir referência `newSubData` na resposta (linha 427-431):**

Substituir `newSubData.id` e `newSubData.status` por `newAsaasId` e `newStatus` que já existem como variáveis locais.

### Arquivo modificado

- `supabase/functions/asaas-upgrade-subscription/index.ts` — 3 alterações, deploy necessário

