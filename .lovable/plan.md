

# Fix: "Gerenciar assinatura" desaparece após cancelamento

## Problema

O link "Gerenciar assinatura" na página de Créditos depende de `hasTransferPlan`, que vem do hook `useTransferStorage`. Esse hook consulta apenas assinaturas com status `ACTIVE`, `PENDING` ou `OVERDUE` (linha 19). Após cancelar, o status muda para `CANCELLED` e o link some, impedindo o usuário de acessar a página de gerenciamento para desfazer o cancelamento.

## Solução

Duas mudanças simples:

### 1. `src/hooks/useTransferStorage.ts` — Incluir CANCELLED com período vigente

Alterar a query para também buscar assinaturas `CANCELLED` cuja `next_due_date` ainda está no futuro, usando a mesma lógica de fallback já implementada no `useAsaasSubscription`:
- Buscar primeiro `ACTIVE/PENDING/OVERDUE`
- Se não encontrar, buscar `CANCELLED` com `next_due_date >= now()`

Isso faz `hasTransferPlan` retornar `true` durante o período vigente pós-cancelamento.

### 2. `src/pages/Credits.tsx` — Sempre mostrar link quando há assinatura (ativa ou cancelada vigente)

O link "Gerenciar assinatura" já depende de `hasTransferPlan`, então a correção no hook resolve automaticamente. Nenhuma mudança adicional necessária neste arquivo.

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/hooks/useTransferStorage.ts` | Incluir CANCELLED com `next_due_date` futuro na query |

