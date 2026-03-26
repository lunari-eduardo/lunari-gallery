
# Diagnóstico consolidado: sei exatamente onde o fluxo está quebrando

## Problema real

Não é “um bug isolado”. Hoje existem 3 falhas estruturais se somando:

1. `asaas-gallery-payment` está **confirmando cartão cedo demais**
   - para cobrança parcelada, ele cria só a **parcela 1**
   - chama `finalize_gallery_payment` inline
   - depois o banco recalcula a cobrança como `parcialmente_pago`
   - resultado: o frontend recebe “pagamento aprovado”, mas o estado oficial continua incompleto

2. `check-payment-status` está **cego para `parcialmente_pago`**
   - ele só faz polling Asaas quando `status = 'pendente'`
   - no caso atual a cobrança `82f98c25...` ficou:
     - `status = parcialmente_pago`
     - `total_parcelas = 2`
     - `parcelas_pagas = 1`
   - então o polling nunca mais consulta o Asaas para buscar a parcela 2

3. `asaas-webhook` compartilhado está **fora do contrato**
   - o arquivo atual é legado
   - ele atualiza `cobrancas/galerias/clientes_sessoes` manualmente
   - não usa `cobranca_parcelas` como fonte de verdade
   - não segue a cadeia correta: parcela → reconcile → cobrança → transação → sessão
   - isso explica os loops de taxa / status / sincronização

## Evidências encontradas

### Caso mais recente
Cobrança do usuário `07diehl`:
- `cobranca.id = 82f98c25-9136-4623-8398-7ed7efec638a`
- `status = parcialmente_pago`
- `total_parcelas = 2`
- `parcelas_pagas = 1`
- `valor_liquido = 7.08`

Parcela existente:
- só existe `numero_parcela = 1`
- `asaas_payment_id = pay_w11vq6mxjv6n1yzu`

Galeria vinculada:
- `galeria.id = a8df8bee-f935-486e-81f4-28e8f91ae395`
- `status_selecao = aguardando_pagamento`
- `status_pagamento = pendente`

Sessão vinculada:
- `status_galeria = em_selecao`

Logs:
- `check-payment-status` está encontrando essa cobrança repetidamente como `parcialmente_pago`
- não há continuação do processamento
- isso confirma o gargalo no polling

## Por que o cliente vê “confirmada” e depois volta ao checkout

O fluxo atual faz isso:

```text
AsaasCheckout (cartão)
→ recebe result.paid = true
→ chama onPaymentConfirmed()
→ UI muda localmente para "confirmed"
→ 2s depois refetchGallery()
→ gallery-access devolve "aguardando_pagamento"
→ ClientGallery renderiza AsaasCheckout de novo
```

Ou seja:
- a UI está otimista
- o backend não chegou ao estado terminal real
- a tela “confirmada” é falsa/temporária

## Correção robusta que vou aplicar

### 1. Corrigir `asaas-gallery-payment`
Remover a finalização inline prematura para cartão parcelado.

Implementação:
- continuar inserindo cobrança sempre como `pendente`
- **não** chamar `finalize_gallery_payment` logo após criar a cobrança parcelada
- salvar `asaas_installment_id` como já está
- para cartão:
  - se não houver parcelamento, pode processar a cobrança individual com segurança
  - se houver parcelamento, tratar via webhook/polling consultando todas as parcelas do installment

Objetivo:
- parar de “mostrar sucesso” antes da cadeia financeira real terminar

### 2. Reescrever `check-payment-status` para suportar cobrança parcial
Hoje ele ignora `parcialmente_pago`. Vou ajustar para:

- consultar Asaas quando status for:
  - `pendente`
  - `parcialmente_pago`
- se houver `asaas_installment_id`, consultar:
  - `GET /v3/installments/{id}/payments`
- percorrer todas as parcelas retornadas
- para cada parcela confirmada:
  - upsert em `cobranca_parcelas`
  - usando `onConflict: 'asaas_payment_id'`
- deixar o trigger `reconcile_cobranca_from_parcelas` recalcular:
  - `parcelas_pagas`
  - `valor_liquido`
  - `status` (`parcialmente_pago` → `pago`)
- só então chamar `finalize_gallery_payment` como sincronização final

Objetivo:
- funcionar mesmo sem webhook
- concluir automaticamente parcelamentos

### 3. Reescrever `asaas-webhook` compartilhado no padrão correto
O arquivo atual está incompatível com a documentação do Gestão.

Vou alinhar ao contrato:
- validar evento relevante:
  - `PAYMENT_CONFIRMED`
  - `PAYMENT_RECEIVED`
  - `PAYMENT_ANTICIPATED`
- localizar cobrança por:
  - `asaas_installment_id = payment.installment` quando existir
  - fallback `mp_payment_id = payment.id`
- extrair:
  - `value`
  - `netValue`
  - `installmentNumber`
  - `billingType`
- fazer upsert em `cobranca_parcelas` com:
  - `onConflict: 'asaas_payment_id'`
- atualizar `cobrancas.valor_liquido`
- chamar `finalize_gallery_payment`
- remover atualizações manuais diretas de galeria/sessão/cobrança que hoje burlam os triggers

Objetivo:
- unificar Gallery + Gestão no mesmo contrato robusto
- impedir novas divergências entre webhook e polling

### 4. Blindar o frontend para não mentir ao usuário
No `AsaasCheckout` / `ClientGallery`:

- parar de considerar “aprovado” apenas porque o create-payment retornou `CONFIRMED`
- após pagamento, a UI deve entrar em “finalizando/verificando”
- só liberar `onPaymentConfirmed` quando:
  - `check-payment-status` retornar `pago`
  - ou Realtime detectar `cobrancas.status = pago`
- se estiver `parcialmente_pago`, continuar verificando em vez de exibir sucesso final

Objetivo:
- eliminar o redirecionamento “confirmada → checkout novamente”

### 5. Preservar compatibilidade com o banco e com o contrato compartilhado
Vou manter:
- inserção inicial sempre como `pendente`
- `cobranca_parcelas` como fonte de verdade
- `finalize_gallery_payment` como sincronização central
- integridade com Gestão e com os triggers atuais

Também vou revisar para não tocar indevidamente no fluxo da InfinitePay, conforme sua regra de projeto.

## Arquivos a ajustar

| Arquivo | Correção |
|---|---|
| `supabase/functions/asaas-gallery-payment/index.ts` | remover finalização prematura e ajustar lógica de cartão/parcelamento |
| `supabase/functions/check-payment-status/index.ts` | suportar `parcialmente_pago`, consultar installment payments e reconciliar todas as parcelas |
| `supabase/functions/asaas-webhook/index.ts` | reescrever no contrato correto baseado em parcelas + RPC |
| `src/components/AsaasCheckout.tsx` | remover sucesso otimista e esperar confirmação real |
| `src/pages/ClientGallery.tsx` | ajustar retorno pós-pagamento para estado de verificação robusto |

## Resultado esperado após a correção

```text
Cliente paga no Asaas
→ cobrança continua pendente/parcial até haver evidência real
→ webhook OU polling busca parcelas no Asaas
→ cobranca_parcelas recebe todas as parcelas confirmadas
→ trigger reconcile atualiza cobrança
→ quando status virar pago, finalize_gallery_payment sincroniza galeria/sessão
→ frontend só libera a galeria quando o banco estiver realmente pago
```

## Impacto prático

Com isso, o sistema passa a ser robusto em 4 cenários:
- cartão à vista
- cartão parcelado
- com webhook configurado
- sem webhook configurado

E elimina o ciclo atual:
- taxa corrigida mas status quebra
- status corrigido mas webhook quebra
- webhook corrigido mas frontend mente

Essa correção trata o fluxo inteiro, não só uma ponta.
