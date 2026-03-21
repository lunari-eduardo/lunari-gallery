

# Fix: Check Constraints Bloqueiam `pago_manual` e `foto_extra`

## Causa Raiz (confirmada nos logs)

```
violates check constraint "cobrancas_status_check"
Failing row contains (..., pago_manual, ...)
```

A tabela `cobrancas` tem **duas CHECK constraints** que não incluem os novos valores:

| Constraint | Valores permitidos | Valor rejeitado |
|---|---|---|
| `cobrancas_status_check` | `pendente, parcialmente_pago, pago, cancelado, expirado` | `pago_manual` |
| `cobrancas_tipo_cobranca_check` | `pix, link, card, presencial` | `foto_extra` |

A RPC `finalize_gallery_payment` tenta `SET status = 'pago_manual'` e a Edge Function tenta `INSERT ... tipo_cobranca = 'foto_extra'` — ambos bloqueados.

## Correção

### Migração SQL única

```sql
-- 1. Expandir status para incluir pago_manual
ALTER TABLE cobrancas DROP CONSTRAINT cobrancas_status_check;
ALTER TABLE cobrancas ADD CONSTRAINT cobrancas_status_check
  CHECK (status = ANY(ARRAY[
    'pendente','parcialmente_pago','pago','pago_manual','cancelado','expirado'
  ]));

-- 2. Expandir tipo_cobranca para incluir foto_extra
ALTER TABLE cobrancas DROP CONSTRAINT cobrancas_tipo_cobranca_check;
ALTER TABLE cobrancas ADD CONSTRAINT cobrancas_tipo_cobranca_check
  CHECK (tipo_cobranca = ANY(ARRAY[
    'pix','link','card','presencial','foto_extra'
  ]));
```

### Nenhuma alteração em código

A Edge Function e a RPC já estão corretas — o único problema são as constraints do banco.

## Arquivo

| Arquivo | Mudança |
|---|---|
| Nova migração SQL | Expandir as duas CHECK constraints |

