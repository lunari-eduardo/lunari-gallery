

## Diagnóstico: Erro "Usuário Não Autenticado" no InfinitePay

### Causa raiz identificada

Existem **2 caminhos** que geram pagamento InfinitePay, e ambos têm vulnerabilidades de autenticação:

**Caminho 1 — Cliente confirma seleção** (`ClientGallery.tsx` → `confirm-selection`)
- Linha 440: chamada via `fetch()` SEM header de Authorization
- Se o gateway do Supabase está validando JWT (mesmo com `verify_jwt = false` no config.toml), a chamada é rejeitada com 401
- CORS headers no `confirm-selection` também estão incompletos (falta headers do SDK)

**Caminho 2 — Fotógrafo recobra** (`PaymentStatusCard.tsx` → `gallery-create-payment`)  
- Linha 137: usa `supabase.functions.invoke()` que envia o JWT do usuário automaticamente
- Se o token expirou, o SDK envia token velho → gateway rejeita com 401
- Não há refresh preventivo do token antes da chamada

**Problema comum**: O `config.toml` define `verify_jwt = false` para ambas as funções, mas essa configuração pode não estar sendo aplicada corretamente no deploy ao Supabase externo. E mesmo que esteja, as chamadas devem ser resilientes.

### Plano de correção definitivo

**1. `src/pages/ClientGallery.tsx` — Adicionar apikey header na chamada confirm-selection**
- Adicionar header `apikey` com a anon key na chamada fetch (linha 441)
- Isso garante que mesmo se verify_jwt estiver ativo, a chamada passa como anon
- Também adicionar `authorization: Bearer <anon_key>` como fallback

**2. `src/components/PaymentStatusCard.tsx` — Refresh de sessão antes de chamar gallery-create-payment**
- Antes de `supabase.functions.invoke('gallery-create-payment')`, chamar `supabase.auth.getSession()` para garantir token fresco
- Se não houver sessão válida, mostrar erro claro ao fotógrafo

**3. `supabase/functions/confirm-selection/index.ts` — CORS headers completos**
- Atualizar CORS para incluir todos os headers do SDK Supabase (x-supabase-client-platform, etc.)
- Garantir que OPTIONS retorna os headers corretos

**4. `supabase/functions/gallery-create-payment/index.ts` — CORS headers (já OK, verificar)**
- Já tem CORS completo — apenas confirmar

### Arquivos alterados
- `src/pages/ClientGallery.tsx` — adicionar auth headers na chamada confirm-selection
- `src/components/PaymentStatusCard.tsx` — refresh de sessão antes do invoke
- `supabase/functions/confirm-selection/index.ts` — CORS headers completos

