

## Diagnóstico: Erro 500 "Usuário não autenticado" no confirm-selection

### Causa raiz

O erro **não está no `confirm-selection`** — ele está na **versão deployada** do `infinitepay-create-link`.

Fluxo atual:
1. `confirm-selection` detecta que precisa criar pagamento InfinitePay
2. Faz `fetch()` para `infinitepay-create-link` com `Authorization: Bearer ${supabaseServiceKey}` (service role key)
3. A versão **deployada** do `infinitepay-create-link` (linha 28) tenta validar esse token como JWT de usuário via `getUser()` ou `getClaims()`
4. Service role key não é um JWT de usuário → "Usuário não autenticado"

A versão **local** do `infinitepay-create-link` já foi corrigida — não tem validação de JWT, aceita `userId` no body. Mas essa versão **nunca foi re-deployada**.

### Solução

**Redeployar `infinitepay-create-link`** — a versão local já está correta (sem auth check, aceita userId no body para chamadas service-to-service do `confirm-selection`).

Nenhuma alteração de código é necessária. Apenas deploy da Edge Function.

