

# Fix: "Confirmar Pago" como Chave Mestra + Correção de Galeria Órfã

## Problema Encontrado (dados reais)

A galeria "Teste" (`8ca891fc`) tem `status_pagamento = 'pendente'`, mas a cobrança associada (`dc7c8539`) já está `status = 'pago'`. A cobrança foi criada com **`galeria_id = NULL`**, então quando o pagamento foi processado (via webhook MP ou confirm manual), a RPC `finalize_gallery_payment` marcou a cobrança como paga mas **pulou a atualização da galeria** porque `galeria_id` era NULL.

Isso também explica por que "Confirmar Pago" mostra erro — ao clicar novamente, a RPC retorna `already_paid: true`, mas a galeria continua pendente, criando inconsistência visual.

### Bugs identificados na RPC `finalize_gallery_payment`

1. **`AND status = 'pendente'` é restritivo demais** — rejeita cobranças com status `aguardando_confirmacao`, `cancelado`, etc. O "Confirmar Pago" precisa ser uma **chave mestra** que funcione para qualquer status.

2. **Não resolve `galeria_id` quando NULL** — se a cobrança tem `session_id` mas não `galeria_id`, a RPC deveria buscar a galeria pelo session_id como fallback.

## Plano

### 1. Migração SQL: Atualizar RPC `finalize_gallery_payment`

**Mudanças:**
- Trocar `AND status = 'pendente'` por `AND status != 'pago'` (aceita qualquer status não-pago)
- Adicionar fallback: se `galeria_id IS NULL` mas `session_id IS NOT NULL`, buscar galeria pela `session_id`
- Isso torna o "Confirmar Pago" uma verdadeira chave mestra para qualquer provedor

### 2. Migração SQL: Corrigir dados órfãos

Atualizar cobranças existentes que têm `session_id` mas `galeria_id = NULL`:
```sql
UPDATE cobrancas c
SET galeria_id = g.id
FROM galerias g
WHERE c.galeria_id IS NULL
  AND c.session_id IS NOT NULL
  AND g.session_id = c.session_id;
```

E re-executar a finalização para a galeria "Teste" especificamente.

### 3. `PaymentStatusCard.tsx` — Melhorar tratamento de erro

Mostrar a mensagem de erro real do servidor (ex: `data.error`) em vez do genérico "Erro ao confirmar pagamento".

## Arquivos

| Arquivo | Mudança |
|---|---|
| Nova migração SQL | Atualizar RPC + corrigir dados órfãos |
| `src/components/PaymentStatusCard.tsx` | Exibir erro real do servidor no toast |

