

# Diagnóstico: Pagamentos Asaas ficam "pendente" — falta polling na API Asaas

## Problema

A Edge Function `check-payment-status` tem lógica de polling **apenas para InfinitePay** (consulta API pública). Para cobranças Asaas pendentes, ela simplesmente retorna o status do banco sem consultar a API Asaas. Sem webhook configurado, o status nunca é atualizado.

**Para cartão de crédito**: O frontend recebe `paid: true` da resposta (linha 406 do `AsaasCheckout.tsx`), mostra "Pagamento aprovado!" ao cliente, mas a cobrança no banco fica `pendente` eternamente. O fotógrafo vê "Pendente" no dashboard.

**Para PIX**: O polling roda a cada 5s mas `check-payment-status` não consulta o Asaas, então nunca confirma.

## Solução

### 1. Adicionar polling Asaas em `check-payment-status/index.ts`

Quando a cobrança é `pendente` e `provedor = 'asaas'`:
1. Buscar `access_token` e `environment` do fotógrafo em `usuarios_integracoes`
2. Consultar `GET /v3/payments/{mp_payment_id}` na API Asaas
3. Se status for `CONFIRMED` ou `RECEIVED`:
   - Extrair `netValue` e calcular `taxa_gateway`
   - Criar `cobranca_parcelas` (upsert)
   - Atualizar `cobrancas.valor_liquido`
   - Chamar RPC `finalize_gallery_payment`
4. Se `PAYMENT_ANTICIPATED`, tratar da mesma forma

Isso segue exatamente o contrato da documentação: extrair `netValue`, criar parcelas, deixar triggers fazerem o resto.

### 2. Cartão confirmado imediatamente — tratar no `asaas-gallery-payment/index.ts`

Quando Asaas retorna `CONFIRMED`/`RECEIVED` para cartão:
- Já temos o `paymentData` com `netValue`
- Chamar lógica de criação de parcela + `finalize_gallery_payment` **inline** antes de retornar
- Isso é seguro porque a cobrança já foi inserida como `pendente`, e a transição `pendente → pago` dispara os triggers corretamente

### Fluxo corrigido

```text
Cartão (confirmação imediata):
  asaas-gallery-payment → INSERT pendente → GET payment (netValue)
    → upsert parcela → update valor_liquido → RPC finalize → retorna paid:true

PIX (assíncrono):
  asaas-gallery-payment → INSERT pendente → retorna QR code
  check-payment-status (polling) → GET /v3/payments/{id}
    → se CONFIRMED: upsert parcela → finalize → retorna status=pago
```

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/check-payment-status/index.ts` | Adicionar função `checkAsaasPaymentStatus()` que consulta API Asaas, cria parcelas e finaliza. Chamar quando `provedor='asaas'` e `status='pendente'` |
| `supabase/functions/asaas-gallery-payment/index.ts` | Após INSERT pendente, se cartão `CONFIRMED`/`RECEIVED`: buscar payment completo com `netValue`, upsert parcela, chamar `finalize_gallery_payment` |

