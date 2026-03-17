

# Diagnóstico: Cobrança de Extras Não é Gerada — Galeria Fica Travada

## Problema Raiz Identificado

A galeria **"Alice - 4 meses"** (id: `423f234f`) está **travada em `status_selecao = 'processando_selecao'`** desde hoje (2026-03-17 00:50). Isso impede qualquer nova tentativa de confirmação.

### Causa técnica

O fluxo é:

```text
1. Cliente clica "Confirmar"
2. confirm-selection chama RPC try_lock_gallery_selection
3. RPC seta status_selecao = 'processando_selecao' ← PONTO SEM RETORNO
4. confirm-selection tenta criar cobrança (InfinitePay/Asaas/MP)
5. Se falhar → função retorna erro HTTP 500
6. status_selecao permanece 'processando_selecao' PARA SEMPRE
7. Cliente tenta novamente → RPC rejeita com "already_processing"
```

**Não existe rollback.** A RPC `try_lock_gallery_selection` faz o lock via `UPDATE` (não via advisory lock transacional), então o status persiste mesmo após erro.

Adicionalmente, o status `aguardando_pagamento` também bloqueia na mesma condição do RPC, o que impede clientes com pagamento pendente de re-tentarem (por exemplo, se o link de checkout expirou).

## Plano de Correção (4 partes)

### 1. Adicionar rollback automático no `confirm-selection` (Edge Function)

Envolver a lógica pós-lock em um try/catch que, em caso de falha, **reseta o `status_selecao`** para `selecao_iniciada`:

```typescript
// No catch de qualquer erro após o lock ser adquirido:
await supabase.from('galerias').update({
  status_selecao: 'selecao_iniciada',
  updated_at: new Date().toISOString(),
}).eq('id', galleryId);
```

Isso garante que falhas transitórias (timeout de API, provedor indisponível) não travem a galeria permanentemente.

### 2. Adicionar TTL (time-to-live) na RPC `try_lock_gallery_selection`

Alterar a RPC para aceitar re-tentativas se o `processando_selecao` tiver mais de **5 minutos** (lock stale):

```sql
IF v_gallery.status_selecao = 'processando_selecao' 
   AND v_gallery.updated_at < now() - INTERVAL '5 minutes' THEN
  -- Lock expirado, permitir re-tentativa
  -- Continua o fluxo normal
ELSE IF v_gallery.status_selecao IN ('selecao_completa', 'processando_selecao', 'aguardando_pagamento') THEN
  RETURN jsonb_build_object('locked', false, 'reason', 'already_processing');
END IF;
```

### 3. Corrigir galeria travada agora (migração de dados)

Executar UPDATE para resetar a galeria travada:

```sql
UPDATE galerias 
SET status_selecao = 'selecao_iniciada', updated_at = now()
WHERE status_selecao = 'processando_selecao' 
  AND updated_at < now() - INTERVAL '5 minutes';
```

### 4. Permitir re-tentativa para `aguardando_pagamento` com cobrança expirada

O status `aguardando_pagamento` bloqueia novas tentativas na RPC. Se o link de checkout expirou (ou o cliente desistiu), não há como retomar. Modificar a RPC para permitir re-tentativa se:
- `status_selecao = 'aguardando_pagamento'` E
- a cobrança mais recente tem status `pendente` e foi criada há mais de **24 horas**

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/confirm-selection/index.ts` | Adicionar rollback do status no catch de erros pós-lock |
| RPC `try_lock_gallery_selection` (migração SQL) | Adicionar TTL de 5min para lock stale + permitir re-tentativa de `aguardando_pagamento` expirado |
| Migração SQL (dados) | Resetar galerias travadas em `processando_selecao` |

## Por que este fluxo quebra sempre que tocamos nele

O fluxo de confirmação tem **acoplamento forte**: uma única Edge Function (`confirm-selection`) faz lock + cálculo de preço + criação de cobrança + atualização de galeria + sync com sessão + audit log. Qualquer falha em qualquer ponto trava tudo.

A adição do rollback + TTL resolve o sintoma e a causa raiz, criando resiliência contra falhas transitórias de qualquer provedor de pagamento.

