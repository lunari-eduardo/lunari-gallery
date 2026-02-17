
# Correcao: Pagamentos InfinitePay nao atualizando galeria + botao "Confirmar Pago"

## Causa raiz (2 problemas)

### Problema 1: Edge functions desatualizadas (deploy antigo)
As edge functions foram editadas no codigo (para usar `selecao_completa` em vez de `confirmado`) mas **nunca foram redeployadas**. A versao em execucao ainda usa termos antigos que podem conflitar com os novos constraints do banco.

### Problema 2: Constraint `galeria_acoes_tipo_check` bloqueando acoes
O constraint da tabela `galeria_acoes` so permite 6 tipos:
- `criada`, `enviada`, `cliente_acessou`, `cliente_confirmou`, `selecao_reaberta`, `expirada`

Mas as edge functions tentam inserir tipos que **nao existem** no constraint:
- `pagamento_informado` (em `client-selection`)
- `pagamento_confirmado` (em `mercadopago-webhook`)
- `foto_selecionada`, `foto_desmarcada`, `foto_favoritada` (em `client-selection`)

Os logs do banco confirmam o erro no momento exato do pagamento:
```
"new row for relation 'galeria_acoes' violates check constraint 'galeria_acoes_tipo_check'"
```

Isso faz com que o fluxo de confirmacao falhe parcialmente - a cobranca atualiza para "pago" mas a galeria nao e finalizada.

## Estado atual no banco (evidencia)
| Registro | Status | Problema |
|---|---|---|
| Cobranca `47863ef5` | `pago` | OK - atualizado corretamente |
| Galeria `bf563230` | `status_pagamento: pendente`, `status_selecao: aguardando_pagamento` | Nao foi atualizada |

## Correcoes

### 1. Migration SQL - Ampliar constraint `galeria_acoes_tipo_check`
Adicionar todos os tipos de acao usados pelas edge functions e frontend:

```sql
ALTER TABLE galeria_acoes DROP CONSTRAINT galeria_acoes_tipo_check;
ALTER TABLE galeria_acoes ADD CONSTRAINT galeria_acoes_tipo_check 
  CHECK (tipo = ANY (ARRAY[
    'criada', 'enviada', 'cliente_acessou', 'cliente_confirmou', 
    'selecao_reaberta', 'expirada',
    'pagamento_informado', 'pagamento_confirmado',
    'foto_selecionada', 'foto_desmarcada', 'foto_favoritada',
    'galeria_excluida'
  ]));
```

### 2. Corrigir galeria travada
Atualizar manualmente a galeria que ficou presa com pagamento pendente:

```sql
UPDATE galerias 
SET status_pagamento = 'pago', 
    status_selecao = 'selecao_completa', 
    finalized_at = NOW()
WHERE id = 'bf563230-1473-413a-be10-85c8d65ce955' 
  AND status_pagamento = 'pendente';
```

### 3. Redeployar TODAS as edge functions de pagamento
Garantir que as versoes atuais (com `selecao_completa`) estejam rodando:
- `check-payment-status`
- `infinitepay-webhook`
- `confirm-selection`
- `client-selection`
- `gallery-access`
- `mercadopago-webhook`

### 4. Nenhuma mudanca de codigo necessaria
O codigo no repositorio ja esta correto. O problema e exclusivamente de deploy desatualizado + constraint restritivo.

## Arquivos afetados

| Arquivo | Mudanca |
|---|---|
| Nova migration SQL | Ampliar `galeria_acoes_tipo_check` + corrigir galeria travada |
| 6 edge functions | Redeploy (sem mudanca de codigo) |

## Por que o "Confirmar Pago" nao funciona
O botao chama `check-payment-status` com `forceUpdate: true`. A funcao atualiza a cobranca para "pago" com sucesso, mas quando tenta atualizar a galeria (definindo `status_selecao: 'selecao_completa'`), a versao antiga deployada pode estar usando `'confirmado'` que viola o constraint. Alem disso, se o fluxo tenta registrar uma acao em `galeria_acoes`, falha no constraint de tipo.
