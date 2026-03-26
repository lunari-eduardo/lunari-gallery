

# Diagnóstico: Taxas de gateway não registradas em pagamentos de fotos extras

## Onde está a falha: **Projeto Gestão (não Gallery)**

### Evidências do banco

| Campo | Valor Atual | Esperado |
|---|---|---|
| `cobrancas.valor_liquido` (22c7deca) | `NULL` | `5.62` (por parcela) |
| `cobrancas.parcelas_pagas` | `0` | `2` |
| `cobranca_parcelas` (para gallery) | **VAZIO** | 2 registros com `taxa_gateway` |
| `clientes_transacoes.taxa_gateway` | `0` | `0.76` (R$12 - R$11.24) |
| `clientes_transacoes.valor_liquido` | `NULL` | `11.24` |

### Cadeia de falha

```text
1. Asaas envia webhook → asaas-webhook (Gestão) ← ÚNICO endpoint configurado
2. asaas-gallery-webhook (Gallery) NUNCA é chamado

3. Gestão webhook (versão DEPLOYADA) tem código gallery-specific:
   → "🔍 Looking for gallery cobrança..."
   → "💰 Processing gallery payment..."
   → Chama finalize_gallery_payment RPC diretamente
   → NÃO cria cobranca_parcelas ← BUG

4. RPC finalize_gallery_payment muda status: pendente → pago
5. Trigger ensure_transaction_on_cobranca_paid dispara
6. Mas cobrancas.valor_liquido = NULL → taxa_gateway = 0
```

### Por que a falha está no Gestão

O código **no repositório** do Gestão (`asaas-webhook/index.ts`) já tem `upsertParcela()` que cria parcelas corretamente. Mas a **versão deployada** tem um código antigo com processamento gallery-specific que bypassa a criação de parcelas.

A prova: os logs mostram mensagens ("Looking for gallery cobrança", "Processing gallery payment", "Gallery finalized via webhook") que **não existem** no código atual do repositório Gestão. Logo, a versão deployada é antiga.

### O que o Gallery está fazendo certo

O `asaas-gallery-webhook/index.ts` (Gallery) tem a implementação correta:
- Extrai `netValue` (linha 159)
- Calcula `taxaGateway` (linha 160)
- Cria `cobranca_parcelas` via upsert (linhas 181-201)
- Atualiza `cobrancas.valor_liquido` (linhas 213-219)

Mas este webhook **nunca é chamado** porque a URL de webhook do Asaas aponta apenas para `asaas-webhook` (Gestão).

## Solução

### Ação 1: Redeployar `asaas-webhook` no Gestão
O código atual do repo já tem `upsertParcela`. Precisa ser deployado para substituir a versão antiga.

### Ação 2 (aqui no Gallery): Correção retroativa via migração SQL
Corrigir a cobrança `22c7deca` (e qualquer outra com `valor_liquido = NULL`) criando as parcelas manualmente a partir dos dados do webhook que já foram logados.

### Ação 3 (aqui no Gallery): Tornar `asaas-gallery-webhook` redundante
Como o Gestão webhook é o ponto único de entrada, o Gallery webhook serve apenas como backup. Nenhuma mudança de código necessária no Gallery — a implementação está correta.

## Migração SQL (correção retroativa)

Criar parcelas para a cobrança `22c7deca` usando os valores do webhook (`netValue: 5.62`, `value: 6`):

```sql
-- Parcela 1
INSERT INTO cobranca_parcelas (cobranca_id, numero_parcela, asaas_payment_id, valor_bruto, valor_liquido, taxa_gateway, status, billing_type, data_pagamento)
VALUES ('22c7deca-24c5-4a9c-a389-eb9dd67e20ca', 1, 'pay_zhgs2jm70oo0xcbm', 6, 5.62, 0.38, 'confirmado', 'card', '2026-03-26');

-- Parcela 2
INSERT INTO cobranca_parcelas (cobranca_id, numero_parcela, asaas_payment_id, valor_bruto, valor_liquido, taxa_gateway, status, billing_type, data_pagamento)
VALUES ('22c7deca-24c5-4a9c-a389-eb9dd67e20ca', 2, 'pay_be0jqy3rgxlsci37', 6, 5.62, 0.38, 'confirmado', 'card', '2026-03-26');
```

O trigger `reconcile_cobranca_from_parcelas` atualizará automaticamente `cobrancas.valor_liquido = 11.24` e `parcelas_pagas = 2`. O trigger `ensure_transaction_on_cobranca_paid` atualizará a transação existente com `taxa_gateway = 0.76`.

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| Nova migração SQL (Gallery) | Inserir parcelas retroativas para cobrança 22c7deca |
| **Gestão: redeployar `asaas-webhook`** | Código atual do repo já tem `upsertParcela` — precisa deploy |

