# Plano — Correção do erro 409 ao criar galeria + hardening

## 1. Causa raiz do erro `duplicate key value violates unique constraint "galerias_session_id_user_id_key"`

Reproduzi via banco. Existe a galeria `462a76b5-024d-49aa-b6cc-74eb5f5ec9d5` com `session_id=workflow-1778206524480-z5joroxulsm` para o usuário e o índice é `UNIQUE (session_id, user_id)` com `nulls distinct=false`.

Fluxo do bug em `src/pages/GalleryCreate.tsx`:

1. Usuário clica **Próximo** no Passo 3.
2. `handleNext` → guarda apenas `isAdvancing` (state assíncrono). Em React, dois cliques rápidos / StrictMode / duplo evento podem ambos passar pelo `if (isAdvancing) return` antes do re-render.
3. Os dois disparos veem `supabaseGalleryId=null` (estado ainda não atualizado pelo `setSupabaseGalleryId` da primeira chamada) e chamam `createSupabaseGalleryForUploads()` em paralelo.
4. Os dois `INSERT` têm o mesmo `session_id` (vindo do `useGestaoParams.initialParamsRef`) e o mesmo `user_id` → o segundo bate no `UNIQUE` e devolve `23505` → toast “Erro ao criar galeria para upload” e a UI fica travada em “Preparando área de upload…”.

A galeria de fato foi criada (banco confirma), mas a UI nunca recebe o `id` do segundo fluxo, então não destrava a tela de upload.

## 2. Correções

### 2.1 Guarda anti-corrida real (ref)
- `src/pages/GalleryCreate.tsx`
  - Adicionar `const creatingGalleryRef = useRef(false)` no topo do componente.
  - No início de `createSupabaseGalleryForUploads`: `if (creatingGalleryRef.current || supabaseGalleryId) return; creatingGalleryRef.current = true;` e liberar no `finally`.
  - No `handleNext`, antes de chamar a função, repetir o gate por ref. Isso previne duplo-disparo independente do ciclo do React.

### 2.2 Reuso defensivo (idempotência server-aware)
- Antes do `INSERT` em `useSupabaseGalleries.ts → createGalleryMutation`, quando vier `sessionId`:
  - Buscar `galerias` por `(user_id, session_id)`.
  - Se existir uma `status='rascunho'`, devolvê-la em vez de tentar inserir (resolvendo casos onde o usuário voltou ao Passo 3 após refresh / abriu duas abas / clicou duas vezes).
  - Se existir não-rascunho, devolver erro claro ("Já existe uma galeria para esta sessão").

### 2.3 Tratar `23505` como recuperável
- Em `createGalleryMutation`, se o erro for `code === '23505'` em `galerias_session_id_user_id_key`, fazer um `SELECT` final por `(user_id, session_id)` e retornar a galeria existente. Garante UX consistente mesmo numa corrida que escapou da guarda do cliente.

### 2.4 Recovery na UI quando o INSERT for "já existe"
- Em `createSupabaseGalleryForUploads`, se a função devolver galeria existente, `setSupabaseGalleryId(existing.id)` igual ao caminho feliz e seguir o fluxo (criar pasta default só se ainda não houver pasta). Hoje a tela trava porque o catch só mostra toast.

## 3. Hardening adicional descoberto na auditoria

### 3.1 Fluxo de criação
- `handleNext` libera `setCurrentStep(currentStep+1)` mesmo quando `createSupabaseGalleryForUploads` falhou. Atualmente a função engole o erro em `try/catch` interno. **Fix:** `createSupabaseGalleryForUploads` deve retornar `boolean` de sucesso; `handleNext` só avança o step se for `true`.
- "Save Draft" (linha ~1010) também faz `INSERT` com `session_id` e está sujeito ao mesmo 23505. Mesma proteção da seção 2.2/2.3 cobre.

### 3.2 Vinculação `clientes_sessoes`
- Após o INSERT da galeria, faz-se `UPDATE clientes_sessoes SET galeria_id=... WHERE session_id=...` sem filtrar por `user_id`. Em teoria `session_id` é único por usuário, mas o filtro por `user_id` é defesa em profundidade contra colisões raras de strings de workflow. **Fix:** acrescentar `.eq('user_id', user.id)`.

### 3.3 Auditoria rápida de cálculos sensíveis (sem alterar lógica de negócio agora)
Itens detectados que ficam para um próximo plano focado, apenas para registro:
- `valorFotoExtraFinal` cai para `fixedPrice` quando `regrasCongeladas` está parcial; quando `pacote.valorFotoExtra` é 0 e há `URL.preco_da_foto_extra`, prevalece a URL — correto, mas o log de divergência só dispara quando `valorJsonb>0`. Se JSONB=0 e URL>0, não há aviso. Adicionar log informativo (sem mudar comportamento).
- `buildRegrasFromDiscountPackages` ordena faixas por `min` e usa a primeira como `valor_foto_extra`. Se o usuário definir uma única faixa começando em `min>1`, o preço base ainda fica correto, mas vale uma validação UX (próximo plano).

Esses 3 itens NÃO entram nesta correção; ficam mapeados para evitar escopo amplo demais.

## 4. Arquivos alterados nesta correção

- `src/pages/GalleryCreate.tsx` — guarda por `useRef`, retorno booleano de `createSupabaseGalleryForUploads`, gate em `handleNext`.
- `src/hooks/useSupabaseGalleries.ts` — pré-checagem por `(user_id, session_id)`, tratamento `23505` recuperável, `update clientes_sessoes` com `user_id`.

## 5. Sem alterações de banco

Constraint `UNIQUE (session_id, user_id)` permanece — é a defesa correta. As correções são todas em camada de aplicação.

## 6. Testes manuais pós-fix

1. Clicar "Próximo" rápido 5x no Passo 3 → uma única galeria criada, tela de upload aparece.
2. Voltar ao Passo 1 e avançar de novo → reutiliza a mesma galeria (sem 23505).
3. Refresh no Passo 4 e voltar → mantém mesma galeria.
4. Criar galeria sem `session_id` (manual) → continua funcionando (NULL é distinto no índice).

