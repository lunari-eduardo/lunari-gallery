

## Diagnóstico: Pagamento Asaas não atualiza galeria

### 3 problemas encontrados

**1. Constraint de banco violada — cobrança nunca é salva**

A edge function `asaas-gallery-payment` insere `tipo_cobranca: 'foto_extra'`, mas a constraint `cobrancas_tipo_cobranca_check` só aceita: `'pix'`, `'link'`, `'card'`, `'presencial'`.

Erro nos logs:
```
new row for relation "cobrancas" violates check constraint "cobrancas_tipo_cobranca_check"
```

Resultado: a cobrança **nunca é salva no banco**, então o webhook não consegue encontrá-la para atualizar o status.

**2. Pagamento confirmado imediatamente, mas galeria não é atualizada**

No sandbox, pagamentos com cartão retornam `status: CONFIRMED` na hora. O frontend mostra "Pagamento aprovado!" e chama `onPaymentConfirmed()`, mas o backend (`asaas-gallery-payment`) **não atualiza a galeria nem a sessão** quando o pagamento é confirmado imediatamente.

**3. Webhook de galeria nunca é chamado**

O `asaas-gallery-webhook` tem **zero logs** — nunca foi invocado. O webhook do Asaas aponta para `asaas-webhook` (que só trata assinaturas). Pagamentos de galeria são ignorados porque `payment.subscription` é null.

---

### Correções

#### 1. `asaas-gallery-payment/index.ts` — Fix tipo_cobranca + finalização imediata

- Linha 370: Mudar `tipo_cobranca: 'foto_extra'` para valor dinâmico:
  - `'card'` se `CREDIT_CARD`
  - `'pix'` se `PIX`
  - `'link'` se `BOLETO`

- Após salvar a cobrança, se `paymentData.status === 'CONFIRMED'`:
  - Atualizar `cobrancas.status = 'pago'`
  - Atualizar `galerias` (status_pagamento, finalized_at, fotos extras)
  - Atualizar `clientes_sessoes` (valor_pago, status_galeria)
  - Inserir ação em `galeria_acoes`

#### 2. `asaas-webhook/index.ts` — Tratar pagamentos de galeria

Para pagamentos **sem** `payment.subscription` (PIX async):
- Buscar cobrança pelo `payment.externalReference` (galeriaId) ou `payment.id` (mp_payment_id)
- Se encontrar cobrança pendente, aplicar a mesma lógica de finalização

#### 3. Configuração no Asaas

Não precisa criar webhook separado. O `asaas-webhook` existente receberá todos os eventos. A correção no código fará ele tratar também pagamentos sem subscription.

---

### Impacto
- Edge functions de InfinitePay e create-link **não são alteradas**
- Retrocompatível — pagamentos futuros serão salvos e finalizados corretamente
- Pagamentos já feitos podem ser confirmados manualmente via "Confirmar pago"

