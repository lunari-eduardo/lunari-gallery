
# Fix: Galeria não atualiza extras/valor quando pagamento Asaas tem parcelas

## Causa raiz

O fluxo Asaas com parcelas segue este caminho:

1. `check-payment-status` → upsert parcela(s) na tabela `cobranca_parcelas`
2. Trigger `reconcile_cobranca_from_parcelas` dispara → atualiza `cobrancas.status = 'pago'`
3. `check-payment-status` chama `finalize_gallery_payment`
4. **BUG**: A RPC detecta que parcelas já existem (linha 106-116) e retorna `delegated_to_parcelas: true` **SEM atualizar** `galerias.total_fotos_extras_vendidas` nem `valor_total_vendido`

O trigger de reconciliação só atualiza a tabela `cobrancas` — não toca na tabela `galerias`. E a RPC retorna cedo demais.

Resultado: cobrança fica "pago" mas galeria mantém `total_fotos_extras_vendidas = 0` e `valor_total_vendido = 0`.

## Solução

Alterar o branch `delegated_to_parcelas` na RPC `finalize_gallery_payment` para **também** sincronizar a galeria e sessão quando a cobrança já estiver paga pelo trigger.

A lógica será:
1. Detectou que parcelas existem? Re-lê a cobrança (que o trigger pode ter atualizado para `pago`)
2. Se status = `pago`: atualiza `galerias.total_fotos_extras_vendidas`, `valor_total_vendido`, `status_pagamento`, e sincroniza sessão
3. Se status ≠ `pago`: retorna sem alterar (parcelas ainda não completaram)

Isso é seguro porque a galeria é atualizada com `COALESCE(total_fotos_extras_vendidas, 0) + qtd_fotos` apenas quando o status final é `pago`, e o advisory lock impede dupla execução.

## Arquivo a editar

| Arquivo | Mudança |
|---|---|
| Nova migração SQL | Alterar a RPC `finalize_gallery_payment` — no branch `v_has_parcelas`, re-ler cobrança e sincronizar galeria/sessão se status=pago |

Nenhuma mudança em Edge Functions — a RPC será atualizada no banco e todas as funções que a chamam se beneficiam automaticamente.

## Correção retroativa

Atualizar a galeria `294ab43c` que ficou com valores zerados:
```sql
UPDATE galerias
SET total_fotos_extras_vendidas = 2, valor_total_vendido = 50
WHERE id = '294ab43c-5078-4ff5-92d9-4649cc5933a1';
```
