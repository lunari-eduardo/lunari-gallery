
## Diagnóstico (causas prováveis do “fica aguardando e não atualiza”)
1) **Webhook InfinitePay está chegando, mas o UPDATE da cobrança falha no banco**
- Em `webhook_logs` há múltiplos erros para o mesmo `order_nsu` com:
  - **`Cobranca update failed: column "data_transacao" is of type date but expression is of type text`**
- Isso aponta para o trigger de banco **`ensure_tx_on_cobranca_paid` → função `public.ensure_transaction_on_cobranca_paid()`**, que ao inserir em `clientes_transacoes` está passando **`data_transacao` como texto**.
- Resultado: o `UPDATE cobrancas SET status='pago'...` feito pelo **webhook** é **abortado**, então a cobrança fica **pendente**, a galeria fica em **`status_pagamento='pendente'` / `status_selecao='aguardando_pagamento'`** e nada “anda”.

2) **Cliente fica “preso” porque o frontend não revalida por tempo suficiente**
- No `ClientGallery.tsx`, a verificação no retorno `?payment=success` é **pontual**.
- Quando a galeria está em `aguardando_pagamento`, a UI atual usa `PaymentRedirect` e **redireciona de novo pro checkout**, em vez de manter o cliente numa tela “Aguardando confirmação” com **polling automático** por 10 min.

3) **Ações no gerenciamento (fotógrafo) estão incoerentes**
- `PaymentStatusCard` mostra:
  - “Ir para pagamento” (abre checkout antigo — na prática parece “cobrar de novo”, mas não gera nova cobrança)
  - “Verificar status” (manual e pouco útil)
  - “Confirmar pago” só para InfinitePay, mas você quer **para qualquer gateway** e **idempotente**.

---

## Objetivos (comportamento esperado)
1) Pagamento InfinitePay que cair via webhook deve **sempre** marcar `cobrancas.status='pago'` e liberar a galeria.
2) Enquanto estiver `pendente`, cliente deve ver uma tela de **Aguardando confirmação** e o sistema deve:
   - consultar status a cada **30s**
   - por até **10 min**
   - e também checar **imediatamente** quando o cliente abrir novamente a tela/galeria.
3) No gerenciamento da galeria:
   - “Ir para pagamento” → virar **“Cobrar novamente”** (gera **nova cobrança**)
   - remover “Verificar status”
   - “Confirmar pago” deve funcionar **para qualquer modo de pagamento** e não pode gerar duplicidade se webhook chegar atrasado.

---

## Plano de implementação

### A) Correção definitiva do bug no banco (bloqueio do webhook)
**1. Migration SQL (obrigatória)**
- Alterar a função **`public.ensure_transaction_on_cobranca_paid()`**:
  - corrigir o INSERT em `clientes_transacoes.data_transacao` para **enviar tipo `date`** (remover `::text`)
  - recomendado: incluir o `NEW.id` (cobranca id) na `descricao` para facilitar auditoria e deduplicação humana

**Exemplo do ponto a corrigir (conceito):**
- De: `COALESCE(NEW.data_pagamento::date, CURRENT_DATE)::text`
- Para: `COALESCE(NEW.data_pagamento::date, CURRENT_DATE)`

**2. Verificação pós-migration**
- Reprocessar manualmente 1 cobrança pendente (via “Confirmar pago” ou via polling) e validar que:
  - `cobrancas.status` muda para `pago`
  - `galerias.status_pagamento` muda para `pago`
  - `clientes_transacoes` é criado sem erro
  - (se houver sessão) `clientes_sessoes.valor_pago` é recalculado pelo trigger de recompute

---

### B) Revalidação automática (polling) no lado do cliente (ClientGallery)
**3. Trocar o comportamento quando `gallery-access` retorna `pendingPayment`**
- Hoje: se tiver `checkoutUrl`, renderiza `PaymentRedirect` e joga o cliente de volta pro checkout.
- Novo: criar uma tela “**Aguardando confirmação do pagamento**” com:
  - Status “pendente”
  - Botão “Abrir checkout” (opcional)
  - Polling automático:
    - intervalo: **30s**
    - duração máx: **10 min**
    - checagem imediata ao montar

**4. Polling também no retorno `?payment=success`**
- Na tela “Confirmando seu pagamento…” (a do print), manter a UX, mas:
  - se ainda não confirmado, **continuar tentando automaticamente** (30s / 10 min)
  - manter botão “Verificar novamente” como fallback, mas não depender dele

**5. Critério de “liberar automaticamente”**
- Ao receber `check-payment-status` retornando `status='pago'` (ou `updated=true`):
  - chamar `refetchGallery()` (gallery-access)
  - transicionar para estado confirmado/finalizado sem travar o usuário no “aguardando”

**Arquivos previstos**
- `src/pages/ClientGallery.tsx` (principal)
- possivelmente novo componente: `src/components/PaymentPendingScreen.tsx` (reuso e código limpo)

---

### C) Robustez no `check-payment-status` (sem quebrar InfinitePay)
> Observação importante: esta parte mexe numa zona crítica. Vamos fazer mudanças mínimas, com foco em idempotência e seleção correta do registro.

**6. Ajustes mínimos**
- Quando buscar por `sessionId`, selecionar a cobrança **mais recente**:
  - `order by created_at desc limit 1`
- Tornar a finalização **idempotente** (anti-duplicação):
  - atualizar `cobrancas` para `pago` com condição `status != 'pago'` e só “processar extras/finalização” se realmente houve transição
  - isso evita corrida entre webhook + polling + botão “Confirmar pago”

**Arquivo**
- `supabase/functions/check-payment-status/index.ts`

---

### D) Gestão da galeria (fotógrafo): “Cobrar novamente” + “Confirmar pago” universal
**7. UI/UX**
- `PaymentStatusCard.tsx`:
  - renomear “Ir para pagamento” → **“Cobrar novamente”**
  - **remover** botão “Verificar status”
  - manter “Confirmar pago”, mas:
    - mostrar para qualquer `provedor` quando `status='pendente'` e há `cobrancaId`
    - ao clicar, chamar confirmação manual idempotente (ver abaixo)

**8. Modal “Cobrar novamente” (escolher gateway)**
- Ao clicar “Cobrar novamente”:
  - abrir modal com `PaymentMethodSelector` mostrando integrações ativas (`usePaymentIntegration`)
  - ao confirmar:
    - criar uma nova cobrança do tipo “link” no gateway escolhido
    - retornar `checkoutUrl` para copiar/abrir

**9. Backend para recobrança**
- Opção recomendada: **corrigir e reaproveitar** `supabase/functions/gallery-create-payment/index.ts` (está quebrada hoje porque chama create-link sem `userId/galeriaId/galleryToken/qtdFotos`).
- Atualizar para aceitar no body:
  - `galleryId`
  - `provider` escolhido
  - `valorTotal`, `extraCount/qtdFotos`, `descricao` (opcional)
- E internamente chamar `infinitepay-create-link` / `mercadopago-create-link` com o **payload completo** (incluindo `userId`, `galeriaId`, `galleryToken`, `qtdFotos`, etc).

**10. Backend para “Confirmar pago” universal (qualquer provedor)**
- Criar Edge Function nova (mais segura e explícita) ex: `supabase/functions/confirm-payment-manual/index.ts`:
  - input: `cobrancaId` (obrigatório) e opcional `receiptUrl`, `paidAt`
  - comportamento:
    - se `cobrancas.status='pago'` → retorna ok (idempotente)
    - se `pendente` → marca `pago` e finaliza galeria via mesma regra de crédito já usada (incremento de extras + valor_total_vendido + status_pagamento + status_selecao + finalized_at)
  - garante que webhook atrasado não duplique: webhook checa `status='pago'` e sai.

**Arquivos previstos**
- `src/components/PaymentStatusCard.tsx`
- `src/pages/GalleryDetail.tsx` (para integrar modal e refresh)
- `supabase/functions/gallery-create-payment/index.ts` (fix/upgrade)
- `supabase/functions/confirm-payment-manual/index.ts` (novo)

---

## Critérios de validação (checklist)
1) **Webhook**: realizar um Pix InfinitePay e confirmar que `cobrancas` muda para `pago` sem erro no `webhook_logs`.
2) **Cliente (aguardando)**: iniciar pagamento e:
   - ver tela “Aguardando confirmação”
   - sistema checa a cada 30s por 10min
   - ao confirmar, libera automaticamente (sem precisar recarregar manualmente)
3) **Reabrir link**: após pagar e esperar alguns minutos, abrir de novo a galeria; deve revalidar e liberar.
4) **Gestão**:
   - “Cobrar novamente” abre modal de gateways e gera novo link
   - “Confirmar pago” marca como pago sem duplicar mesmo se webhook chegar depois
5) Regressão: MercadoPago e Pix Manual continuam funcionando como antes.

---

## Observações importantes (integridade financeira)
- A correção do trigger do banco é o “ponto zero”: sem isso, o webhook pode continuar falhando silenciosamente e nenhum polling vai resolver 100%.
- As mudanças propostas em InfinitePay serão **minimizadas** e focadas em:
  - idempotência (não duplicar)
  - seleção correta da cobrança mais recente
  - revalidação automática conforme sua regra (30s/10min)
