

# Fix: useGalleryAccess — consultar subscriptions_asaas + regras de integração corretas

## Problema

`useGalleryAccess.ts` consulta a tabela antiga `subscriptions` (vazia para assinaturas Asaas). Precisa consultar `subscriptions_asaas` e aplicar as regras corretas de integração.

## Regras de integração Gestão

| Condição | hasGestaoIntegration |
|---|---|
| admin | true |
| combo_completo | true |
| combo_pro_select2k | true |
| studio_pro | true |
| Trial ativo (studio_trial_ends_at > now) | true |
| studio_starter | false |
| transfer_* | false |
| Sem plano, trial expirado | false |

## Correção: `src/hooks/useGalleryAccess.ts`

Substituir o bloco de query (linhas 62-100) por:

1. Consultar `subscriptions_asaas` com status IN ('ACTIVE', 'PENDING', 'OVERDUE') ou CANCELLED com `next_due_date` futuro
2. Mapear `plan_type` para `accessLevel`:
   - `combo_completo`, `combo_pro_select2k` → `pro_gallery`
   - `studio_pro` → `pro`
   - `studio_starter` → `starter`
   - `transfer_*` → `free`
3. Se nenhuma assinatura ativa, consultar `profiles.studio_trial_ends_at`:
   - Se trial ativo (data futura) → `pro` (integração habilitada)
   - Senão → `free`
4. Atualizar `hasGestaoIntegration` para incluir `pro`:
   - `isAdmin || accessLevel === 'pro_gallery' || accessLevel === 'pro'`

Usar `getPlanDisplayName()` de `transferPlans.ts` para nome amigável.

## Arquivo a editar

| Arquivo | Mudança |
|---|---|
| `src/hooks/useGalleryAccess.ts` | Query `subscriptions_asaas`; trial check via `profiles`; integração para pro_gallery, pro e trial ativo |

