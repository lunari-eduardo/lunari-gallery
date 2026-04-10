

# Fix: Usuários autorizados pelo admin não recebem integração Gestão

## Problema

O hook `useGalleryAccess` verifica apenas `user_roles` (admin), `subscriptions_asaas` (assinatura ativa) e `profiles.studio_trial_ends_at` (trial). A tabela `allowed_emails` — onde o admin autoriza usuários com planos específicos — não é consultada. Resultado: usuários como `eduardo22diehl@gmail.com` (autorizado com `combo_completo`) recebem `accessLevel: 'free'`, sem integração Gestão.

## Solução

Adicionar verificação de `allowed_emails` no `useGalleryAccess`, entre a checagem de admin e de `subscriptions_asaas`.

## Mudança

| Arquivo | O que muda |
|---|---|
| `src/hooks/useGalleryAccess.ts` | Após checar admin, consultar `allowed_emails` pelo email do usuário. Se encontrado, usar `plan_code` para determinar `accessLevel` via `PLAN_INCLUDES`, igual à lógica de assinaturas |

### Lógica adicionada (~15 linhas)

```typescript
// 1.5. Check allowed_emails (admin-authorized users)
const { data: allowedEmail } = await supabase
  .from('allowed_emails')
  .select('plan_code')
  .eq('email', user.email)
  .maybeSingle();

if (allowedEmail) {
  const planCode = allowedEmail.plan_code || 'combo_completo';
  const includes = PLAN_INCLUDES[planCode];
  
  if (includes?.studio && includes?.select) {
    setAccessLevel('pro_gallery');
  } else if (includes?.studio) {
    setAccessLevel('pro');
  } else if (planCode === 'studio_starter') {
    setAccessLevel('starter');
  } else {
    setAccessLevel('free');
  }
  setPlanName(getPlanDisplayName(planCode));
  setIsLoading(false);
  return;
}
```

`PLAN_INCLUDES` já possui `combo_completo: { studio: true, select: true, transfer: true }`, então o resultado será `pro_gallery` → `hasGestaoIntegration: true` → modo assistido funciona.

### Impacto
- Zero impacto em usuários com assinatura ativa (a checagem de `allowed_emails` só é alcançada se não houver role admin)
- Prioridade: admin > allowed_emails > assinatura > trial > free
- Nenhuma migração SQL necessária

