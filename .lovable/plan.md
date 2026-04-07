

# Fix: Taxas de gateway registradas como despesa do fotógrafo mesmo quando cliente paga

## Causa raiz

O trigger `ensure_transaction_on_cobranca_paid` lê as flags de repasse de `cobrancas.dados_extras`:

```sql
v_repassar_processamento := COALESCE((NEW.dados_extras->>'repassarTaxasProcessamento')::boolean, false);
```

Porém, **nenhuma das duas Edge Functions** que criam cobranças Asaas salva `dados_extras` com essas flags:

- `asaas-gallery-payment` (Gallery) — `cobrancaData` não inclui `dados_extras`
- `gestao-asaas-create-payment` (Gestão) — mesmo problema

Resultado: `dados_extras = NULL` → `repassarTaxasProcessamento = false` → trigger registra taxa de R$1,76 como despesa do fotógrafo, mesmo quando o cliente pagou as taxas (`!absorverTaxa`).

## Solução

Adicionar `dados_extras` com as flags de repasse no INSERT da cobrança, em ambas as functions.

### 1. `asaas-gallery-payment/index.ts` (Gallery)

Após montar `cobrancaData` (linha ~419), adicionar:

```typescript
// Save repasse flags so trigger creates correct transaction
cobrancaData.dados_extras = {
  repassarTaxasProcessamento: !settings.absorverTaxa,
  repassarTaxaAntecipacao: false, // Gallery currently doesn't support anticipation repasse
};
```

A lógica já existe: `settings.absorverTaxa` é lido da integração. Se `absorverTaxa = true`, o fotógrafo absorve → `repassar = false` → trigger registra taxa. Se `absorverTaxa = false`, cliente paga → `repassar = true` → trigger NÃO registra taxa.

### 2. Problema no Gestão (notificação)

O mesmo bug existe em `gestao-asaas-create-payment/index.ts` do projeto [Lunari_gestão](/projects/21abfd0b-b5cd-4139-9caf-a27593cb49ee). A function calcula `repassarTaxas` e `repassarAntecipacao` nas linhas 219-221, mas não salva em `dados_extras` da cobrança. **Essa correção precisa ser feita no projeto Gestão também.**

### 3. Correção retroativa

A cobrança `bb08db9d` já foi finalizada com taxa incorreta. Corrigir a transação existente:

```sql
UPDATE clientes_transacoes
SET taxa_gateway = 0,
    valor_liquido = 50
WHERE cobranca_id = 'bb08db9d-08fc-411b-a725-37dde55b50b4';
```

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/asaas-gallery-payment/index.ts` | Adicionar `dados_extras` com flags de repasse no `cobrancaData` |
| Nova migração SQL | Corrigir transação da cobrança `bb08db9d` |
| **Gestão** (outro projeto) | Mesmo fix em `gestao-asaas-create-payment/index.ts` — adicionar `dados_extras` com `repassarTaxas` e `repassarAntecipacao` |

## Nota importante

A correção no projeto Gestão deve ser feita separadamente naquele projeto. Aqui corrigiremos apenas a parte do Gallery e a migração de dados.

