

## Plano de Correção: Pagamento Obrigatório Não Pode Falhar Silenciosamente

### Diagnóstico do Problema

Após análise completa do fluxo, identifiquei **DOIS PROBLEMAS CRÍTICOS**:

---

### PROBLEMA 1: Versão Antiga do Edge Function Deployada

A função `infinitepay-create-link` que estava em produção tinha verificação de autenticação na linha 28, retornando "Usuário não autenticado". A versão no código-fonte NÃO tem essa verificação, indicando que o deploy não havia sido feito.

**Evidência dos Logs:**
```
Error: Usuário não autenticado
    at Server.<anonymous> (...infinitepay-create-link/index.ts:28:13)
```

**Status:** Corrigido durante esta investigação com redeploy.

---

### PROBLEMA 2: Falha de Pagamento Não Impede Confirmação da Galeria

O fluxo atual no `confirm-selection`:

```text
1. PRIMEIRO: Atualiza galeria (status=selecao_completa, finalized_at=agora)
         │
         ▼
2. DEPOIS: Tenta criar pagamento InfinitePay
         │
         ├── SUCESSO: Retorna checkoutUrl → Cliente redireciona
         │
         └── FALHA: Apenas loga erro → Retorna SEM checkoutUrl
                                      → Cliente vai para "Confirmado"
                                      → Galeria FINALIZADA sem cobrança!
```

**Resultado:** A galeria é confirmada mesmo quando o pagamento obrigatório falha, exibindo "Sem cobrança" e permitindo que o cliente finalize sem pagar.

---

### Correção Necessaria

#### Arquivo: `supabase/functions/confirm-selection/index.ts`

Modificar o fluxo para garantir que a confirmação só seja finalizada SE o pagamento for criado com sucesso quando obrigatório:

**Estrategia A - Inverter ordem (criar pagamento ANTES de confirmar):**

```text
1. PRIMEIRO: Validar galeria e calcular valores
         │
         ▼
2. SE modo=sale_with_payment E valorTotal > 0:
         │
         ├── Tentar criar pagamento
         │         │
         │         ├── SUCESSO: Continuar para confirmação
         │         │
         │         └── FALHA: RETORNAR ERRO (não confirmar galeria!)
         │
         ▼
3. SÓ ENTÃO: Atualizar galeria para confirmada
```

**Modificações especificas:**

1. **Mover criação de pagamento ANTES da atualização da galeria** (linhas 215-225)

2. **Se pagamento falhar, retornar erro** em vez de apenas logar:

```typescript
// ANTES (problema):
if (!paymentError && paymentData?.success) {
  // sucesso
} else {
  console.error('Payment creation failed:', paymentError); // Apenas log!
}

// DEPOIS (correção):
if (!paymentError && paymentData?.success) {
  // sucesso
} else {
  // FALHA CRÍTICA - NÃO confirmar galeria!
  return new Response(
    JSON.stringify({ 
      error: 'Erro ao criar cobrança. Tente novamente.',
      code: 'PAYMENT_FAILED',
      details: paymentError?.message || paymentData?.error
    }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

3. **Atualizar status_pagamento corretamente:**
   - Se pagamento criado com sucesso: `status_pagamento = 'pendente'`
   - Se não requer pagamento: `status_pagamento = 'sem_vendas'`
   - Se falha: **não confirmar galeria**

---

### Resumo das Modificações

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/confirm-selection/index.ts` | Reordenar fluxo: criar pagamento ANTES de confirmar galeria |
| `supabase/functions/confirm-selection/index.ts` | Retornar erro se pagamento obrigatório falhar |
| `supabase/functions/confirm-selection/index.ts` | Atualizar status_pagamento corretamente |

---

### Fluxo Corrigido

```text
┌──────────────────────────────────────────────────────────┐
│ NOVO FLUXO - PAGAMENTO OBRIGATÓRIO                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  1. Validar galeria e calcular valores                   │
│          │                                               │
│          ▼                                               │
│  2. Verificar: modo=sale_with_payment AND valor > 0?     │
│          │                                               │
│          ├── SIM: Criar pagamento PRIMEIRO               │
│          │         │                                     │
│          │         ├── SUCESSO → Continua                │
│          │         │                                     │
│          │         └── FALHA → RETORNA ERRO (400/500)    │
│          │                     Galeria NÃO confirmada!   │
│          │                                               │
│          └── NÃO: Continua sem pagamento                 │
│          │                                               │
│          ▼                                               │
│  3. SÓ AGORA: Atualizar galeria (confirmada + status)    │
│          │                                               │
│          ▼                                               │
│  4. Retornar sucesso + checkoutUrl (se aplicável)        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

### Tratamento no Frontend

O frontend (`ClientGallery.tsx`) já trata erros corretamente:

```typescript
// Linhas 389-391
if (!response.ok) {
  const error = await response.json();
  throw new Error(error.error || 'Erro ao confirmar seleção');
}
```

Com a correção, quando o pagamento falhar, o cliente verá uma mensagem de erro e poderá tentar novamente, em vez de ter a galeria finalizada incorretamente.

---

### Testes de Validação

Após a implementação:

1. **Teste com pagamento funcionando:**
   - Criar galeria com sale_with_payment
   - Confirmar seleção com extras
   - Verificar redirecionamento para checkout
   - Verificar status_pagamento = 'pendente'

2. **Teste com pagamento falhando:**
   - Simular falha (ex: handle inválido)
   - Confirmar que galeria NÃO é finalizada
   - Confirmar mensagem de erro exibida
   - Confirmar status original mantido

3. **Teste sem pagamento:**
   - Criar galeria com sale_without_payment
   - Confirmar seleção
   - Verificar status_pagamento = 'sem_vendas'

