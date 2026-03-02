

## Plano: Correção de Cobranças InfinitePay na Finalização de Seleção

### Problemas identificados

Analisei o fluxo completo: `ClientGallery.tsx` → `confirm-selection` → `infinitepay-create-link` → InfinitePay API, e também o fluxo de retorno via `gallery-access` + `check-payment-status`.

**Problema 1: `supabase.functions.invoke()` engole detalhes do erro**
Em `confirm-selection` (linha 366), quando chama `infinitepay-create-link` via `supabase.functions.invoke()`, se a função interna retorna HTTP 400/500, o SDK coloca o erro em `paymentError` mas a mensagem é genérica ("Edge Function returned a non-2xx status code"). Os detalhes reais do erro (ex: "InfinitePay não retornou URL de checkout") são perdidos. O `confirm-selection` retorna para o cliente apenas `paymentError.message` que não ajuda a diagnosticar.

**Problema 2: `infinitepay-create-link` não retorna `success: false` em todas as respostas de erro**
As respostas de erro nas linhas 96, 169, 184, 196, 226 retornam `{ error: '...' }` sem o campo `success: false`. Quando `supabase.functions.invoke()` consegue parsear o body (status 200 com erro lógico hipotético), o check `paymentData?.success` falha silenciosamente.

**Problema 3: InfinitePay API pode retornar non-JSON (HTML error pages)**
A API `api.infinitepay.io` pode retornar 502/503 com body HTML. O código atual tenta `JSON.parse(responseText)` e falha, mas sem retry. Um erro transitório causa falha permanente para o cliente.

**Problema 4: Sem timeout nem retry na chamada à API InfinitePay**
`fetch()` sem `AbortSignal` + sem retry. Se a API demora ou falha temporariamente, o cliente recebe erro sem segunda chance.

**Problema 5: Erro genérico para o cliente final**
`ClientGallery.tsx` (linha 486) mostra `error.message` que vem da Edge Function. Quando é "Erro ao processar cobrança. Tente novamente.", o cliente não tem contexto e nem botão de retry automático.

---

### Correções propostas

#### 1. `supabase/functions/infinitepay-create-link/index.ts`
- Adicionar retry com backoff exponencial (3 tentativas) na chamada à API InfinitePay
- Validar `Content-Type` da resposta antes de parsear JSON
- Padronizar TODAS as respostas de erro com `{ success: false, error: '...', code: '...' }`
- Adicionar timeout de 30s via `AbortSignal`

#### 2. `supabase/functions/confirm-selection/index.ts`
- Trocar `supabase.functions.invoke()` por `fetch()` direto ao endpoint da Edge Function (`${supabaseUrl}/functions/v1/infinitepay-create-link`). Isso dá controle total sobre o parsing da resposta e evita o SDK engolir erros.
- Extrair `error` e `code` do body JSON da resposta, não do wrapper do SDK
- Logar o body completo da resposta de erro para diagnóstico
- Propagar `code` de erro para o cliente para permitir ações específicas (retry, reconfigurar provedor, etc.)

#### 3. `src/pages/ClientGallery.tsx`
- No `onError` da `confirmMutation`: mostrar mensagem mais clara baseada no `code` de erro
- Adicionar botão "Tentar novamente" automático quando erro é `PAYMENT_FAILED` ou `PAYMENT_ERROR`
- Para `NO_PAYMENT_PROVIDER`: mostrar mensagem orientando o cliente a contatar o fotógrafo

#### 4. `src/components/PaymentRedirect.tsx`
- Tratar `checkoutUrl` vazio/undefined: ao invés de redirecionar para `undefined`, mostrar tela de erro com instruções

---

### Ordem de implementação

1. Robustecer `infinitepay-create-link` (retry, timeout, validação, respostas padronizadas)
2. Corrigir `confirm-selection` para usar `fetch()` direto e propagar erros detalhados
3. Melhorar UX de erro em `ClientGallery.tsx` (retry, mensagens contextuais)
4. Proteger `PaymentRedirect.tsx` contra URL inválida

