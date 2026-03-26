

# Fix: Taxas de gateway não registradas — constraint ausente em `cobranca_parcelas`

## Causa raiz

Os logs confirmam o erro:

```
❌ Erro ao upsert parcela: {
  code: "42P10",
  message: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
}
```

O código usa `onConflict: 'cobranca_id,numero_parcela'`, mas a tabela `cobranca_parcelas` **não tem** essa unique constraint. Tem apenas:
- `PRIMARY KEY (id)`
- `UNIQUE (asaas_payment_id)`

O upsert falha silenciosamente, parcela não é criada, `valor_liquido` fica NULL, e a taxa de gateway não é registrada na transação.

Isso afeta **todos os usuários** (não só o não-admin). O teste anterior com admin provavelmente funcionou porque o webhook do Gestão processou antes, ou a parcela já existia.

## Solução

### 1. Migração SQL — criar a constraint faltante

```sql
ALTER TABLE cobranca_parcelas
ADD CONSTRAINT cobranca_parcelas_cobranca_id_numero_parcela_key
UNIQUE (cobranca_id, numero_parcela);
```

### 2. Backfill — corrigir cobrança do teste atual

Buscar a cobrança pendente do usuário `07diehl` e inserir a parcela manualmente com os dados corretos (o pagamento já foi confirmado no Asaas mas a parcela nunca foi criada).

### 3. Redeploy das Edge Functions

Após a constraint existir, as functions `asaas-gallery-payment` e `check-payment-status` funcionarão corretamente sem mudança de código — o `onConflict: 'cobranca_id,numero_parcela'` passará a funcionar.

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| Nova migração SQL | `ADD CONSTRAINT ... UNIQUE (cobranca_id, numero_parcela)` + backfill da cobrança pendente |
| Redeploy `asaas-gallery-payment` | Necessário para garantir versão atual |
| Redeploy `check-payment-status` | Necessário para garantir versão atual |

