

## Diagnóstico

### Problema 1: Combo cards inativos na página Credits
Os botões "Quero integrar" e "Estruturar meu negócio" em `Credits.tsx` (linhas 238 e 258) chamam `toast.info('Em breve!')` em vez de navegar para o checkout. Na página `CreditsCheckout.tsx`, os combos já estão funcionais (linhas 402-411).

### Problema 2: Plano Transfer ativo não aparece no Gallery
O hook `useTransferStorage.ts` busca a assinatura ativa com `.limit(1).maybeSingle()` **sem filtrar por plan_type**. O usuário `bb4e...` possui `studio_starter` (ACTIVE) e `transfer_5gb` (ACTIVE). Como a query ordena por `created_at DESC` e retorna apenas 1 registro, provavelmente retorna `studio_starter` (criado mais recentemente). Como `hasTransferStorage('studio_starter')` retorna `false`, a UI mostra "Armazenamento gratuito".

---

## Plano de Implementação

### 1. Corrigir `useTransferStorage` para buscar assinatura com transfer
Em `src/hooks/useTransferStorage.ts`, alterar a query de assinatura ativa para buscar **todas** as assinaturas ativas e depois filtrar localmente pela que tem transfer storage. Alternativa: buscar todas e usar `hasTransferStorage()` para encontrar a correta.

- Remover `.limit(1).maybeSingle()` na query ativa
- Buscar todas as ativas e filtrar com `hasTransferStorage(plan_type)`
- Aplicar mesma lógica ao fallback de canceladas

### 2. Ativar combo cards na página Credits
Em `src/pages/Credits.tsx`, substituir `toast.info('Em breve!')` por navegação para o checkout:
- "Quero integrar" → `navigate('/credits/checkout?tab=select')` (scroll para combos)
- "Estruturar meu negócio" → `navigate('/credits/checkout?tab=select')` (scroll para combos)

### 3. Verificar prorata no checkout de combos
Na `CreditsCheckout.tsx`, a detecção de upgrade (`hasActiveTransferSub`) verifica apenas `activeSub` (primeira assinatura). Para combos, o usuário pode ter Studio + Transfer ativos simultaneamente. O `handleSubscribe` no combo já passa para a tela de pagamento, mas a prorata precisa considerar **ambas** assinaturas que serão canceladas.

- Na chamada `handleSubscribe` para combos, verificar se há `transferSub` e/ou `studioSub` ativos
- Se sim, passar `subscriptionIdsToCancel[]` em vez de `currentSubscriptionId` singular
- Atualizar `CreditsPayment.tsx` para aceitar array de IDs e chamar `asaas-upgrade-subscription` com `subscriptionIdsToCancel`

### Arquivos impactados
- `src/hooks/useTransferStorage.ts` — corrigir query de assinatura
- `src/pages/Credits.tsx` — ativar botões combo
- `src/pages/CreditsCheckout.tsx` — prorata multi-assinatura para combos
- `src/pages/CreditsPayment.tsx` — suportar upgrade com múltiplas assinaturas canceladas

