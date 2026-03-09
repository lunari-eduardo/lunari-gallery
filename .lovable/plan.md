
## Diagnóstico (o que está acontecendo hoje)
Pelo código atual, existem **2 jeitos** de você cair direto na tela “Seleção Confirmada” sem passar pelo checkout:

1) **O backend (confirm-selection) decide que “não precisa pagar”** e finaliza na hora (`status_selecao = selecao_completa` e/ou `finalized_at` preenchido).  
Isso acontece quando `shouldCreatePayment` vira `false` — e hoje ele depende de um campo enviado pelo frontend (`requestPayment`) + leitura do `saleSettings.mode`.

2) **Mesmo quando o backend diz `requiresPayment: true`**, se ele não mandar `checkoutUrl` nem `asaasCheckoutData` (por qualquer inconsistência de payload/config), o frontend cai no `fallback` e executa:
```ts
setIsConfirmed(true);
setCurrentStep('confirmed');
```
Ou seja: o frontend “confirma” mesmo com pagamento pendente (bug de robustez/UX).

Além disso, você informou um detalhe importante: **Asaas está ativo, mas não é o padrão**. Então o sistema só deve usar Asaas se a galeria tiver `saleSettings.paymentMethod = 'asaas'` (ou se a lógica de provider escolher o Asaas explicitamente). Isso precisa estar garantido e validado no backend.

---

## Objetivo do ajuste
- **Impossibilitar bypass de pagamento** (nem por bug, nem por manipulação de request).
- Garantir que, se a galeria está em **“Venda com pagamento”** e há valor > 0, o fluxo **sempre entra em pagamento** (Asaas checkout transparente).
- **Recuperar galerias que foram “finalizadas por engano”** mas ainda estão com `status_pagamento = pendente`, fazendo o `gallery-access` devolver `pendingPayment` e reabrir o checkout.

---

## Plano de implementação (mudanças no código)

### 1) Edge Function `confirm-selection`: decisão de cobrança 100% server-side (sem depender do frontend)
**Arquivo:** `supabase/functions/confirm-selection/index.ts`

**Mudanças:**
- Parar de usar `requestPayment` como “fonte de verdade”.
- Calcular `shouldCreatePayment` assim (regra imutável do produto):
  - `saleMode === 'sale_with_payment'`
  - `valorTotal > 0`
  - `extrasACobrar > 0` (ou a métrica correta quando `chargeType = all_selected`)
- Se o modo for “com pagamento” e o Asaas estiver selecionado (`paymentMethod === 'asaas'`), **sempre** retornar:
  ```json
  { "requiresPayment": true, "provedor": "asaas", "transparentCheckout": true, "asaasCheckoutData": {...} }
  ```
- Se for “com pagamento” e não achar integração do provider selecionado, retornar erro explícito (e **não** finalizar a galeria).

**Resultado esperado:**
- Mesmo que o frontend envie errado, o backend não finaliza sem pagamento quando a galeria exige pagamento.

---

### 2) Edge Function `gallery-access`: “auto-recovery” quando a galeria foi marcada como concluída mas pagamento está pendente
**Arquivo:** `supabase/functions/gallery-access/index.ts`

Hoje a função decide “finalizada” olhando `status_selecao === selecao_completa || finalized_at`.  
Vamos inserir uma regra **antes** do bloco de “finalized”:

**Nova regra:**
- Se `saleSettings.mode === 'sale_with_payment'` **e**
- `status_pagamento` indicar pendência (ex.: `'pendente'`, `'aguardando_confirmacao'`) **e**
- `valor_extras > 0`  
Então retornar:
```json
{ "pendingPayment": true, "paymentMethod": "asaas", "asaasCheckoutData": {...} }
```

**Por quê isso é crítico:**
- Resolve imediatamente seu caso atual (galeria indo direto para “concluída”), porque a próxima vez que o cliente abrir o link, ele cai no checkout pendente.

---

### 3) Frontend `ClientGallery.tsx`: nunca “confirmar” se o backend indicar pagamento (mesmo com payload incompleto)
**Arquivo:** `src/pages/ClientGallery.tsx`

**Mudanças:**
- No `onSuccess` do `confirmMutation`, alterar o fallback final:
  - Se `data.requiresPayment === true` e não veio `asaasCheckoutData/checkoutUrl/pixData`, **não** chamar `setIsConfirmed(true)`.
  - Em vez disso:
    - mostrar toast “Pagamento pendente — carregando checkout…”
    - `await refetchGallery()`
    - `setCurrentStep('payment')` (ou deixar o `pendingPayment` do `gallery-access` assumir a UI)

**Extra recomendado (observabilidade):**
- Logar no console a resposta do `confirm-selection` (temporário) para ver o payload real que está chegando.

---

### 4) (Opcional, mas recomendado) Testes automatizados das Edge Functions
**Arquivos novos:**
- `supabase/functions/confirm-selection/index.test.ts`
- `supabase/functions/gallery-access/index.test.ts` (ou um teste mínimo)

**Cenários:**
- `sale_with_payment + valorTotal>0` deve retornar `requiresPayment:true` **mesmo se o requestPayment vier false**.
- Galeria com `status_pagamento=pendente` deve voltar como `pendingPayment:true` no `gallery-access` mesmo se `status_selecao` estiver como `selecao_completa`.

---

## Checklist de validação (passo-a-passo)
1) Você me envia o link público (/g/TOKEN) dessa galeria.
2) Eu valido no banco:
   - `configuracoes.saleSettings.mode === 'sale_with_payment'`
   - `configuracoes.saleSettings.paymentMethod === 'asaas'`
   - `valor_foto_extra`/regras congeladas resultando em `valorTotal > 0`
   - `status_pagamento` atual
3) Após implementar as correções acima:
   - Repetir o fluxo de confirmação → deve abrir o checkout transparente
   - Reabrir uma galeria “travada” → deve cair em pendingPayment e abrir checkout

---

## Arquivos envolvidos
- `supabase/functions/confirm-selection/index.ts` (ajuste principal de regra)
- `supabase/functions/gallery-access/index.ts` (recovery de pending payment)
- `src/pages/ClientGallery.tsx` (robustez do fluxo no frontend)
- (Opcional) testes em `supabase/functions/**`

