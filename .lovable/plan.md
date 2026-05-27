# Plano: Corrigir cliente vazio ao criar galeria via PWA mobile

## Diagnóstico

Fluxo atual (Studio → Gallery):
1. Studio (`WorkflowCardCollapsed.tsx`) chama `window.open(buildGalleryNewUrl({...}), '_blank')` com `cliente_id`, `cliente_nome`, `cliente_email`, `cliente_telefone`, `pacote_nome`, `pacote_categoria`, etc.
2. Gallery (`useGestaoParams.ts`) lê os params e congela em `initialParamsRef`.
3. `GalleryCreate.tsx` (linha 566–664) tem um `useEffect` que:
   - **Aguarda** `!isLoadingClients` E `clients.length > 0` antes de processar **qualquer** campo se houver `cliente_id`.
   - Preenche `sessionName`, `packageName`, `includedPhotos`, `saleMode`, etc.
   - Faz `clients.find(c => c.id === gestaoParams.cliente_id)` — se não achar, **silenciosamente** deixa cliente vazio (apenas `console.log`).

### Causas prováveis no PWA mobile (em ordem de probabilidade)

1. **Race / busca falha de cliente:** `useGalleryClients` (`src/hooks/useGalleryClients.ts`) só busca `clientes WHERE user_id = auth.uid()`. No PWA mobile, se a sessão Supabase ainda não tem `user.id` plenamente hidratada no momento do primeiro fetch (RLS retorna vazio) ou se ocorre erro silencioso de rede, `clients` fica `[]` e o `find` retorna `undefined`. Os outros campos (pacote/categoria) **são strings literais dos params** — preenchem sem depender de `clients`. Só o cliente depende do match in‑memory → cenário compatível com o sintoma.
2. **Cliente não está na lista do hook:** se o `cliente_id` veio de uma sessão criada no Studio para um cliente que, por algum motivo (migração antiga, soft-delete, paginação >1000 da query), não aparece em `clients`, o `find` falha. Hoje não há fallback de busca direta por ID.
3. **Redirect de auth perde query params:** `ProtectedRoute.tsx` faz `<Navigate to="/auth" replace />` sem preservar a URL original. No mobile, se a sessão expirou, o usuário entra no `/auth`, faz login e cai numa rota neutra → params perdidos. (Não é o caso atual reportado, mas é uma fragilidade no mesmo fluxo.)
4. **Silêncio do erro:** o `useEffect` não diferencia "cliente não achado" de "ainda carregando" para o usuário. Não há toast, não há retry, não há fallback para criar/buscar pelo `cliente_nome` recebido.

**Conclusão:** o bug imediato é a falta de fallback quando `clients.find(...)` falha. Studio está enviando os dados corretamente (verificado em `buildGalleryNewUrl` e `WorkflowCardCollapsed.tsx`). **Não há alteração necessária no projeto Studio.**

## Correções (Gallery)

### 1. Fallback robusto para resolver o cliente (`GalleryCreate.tsx` + `useGalleryClients.ts`)

- Quando `gestaoParams.cliente_id` está presente e `clients.find(...)` retorna `undefined`:
  - **Buscar o cliente direto no banco** por `id` + `user_id` (uma query pontual, fora da lista cacheada).
  - Se encontrado: injetar no `clients` local (via novo método `addClientToCache`) e selecionar.
  - Se não encontrado mas há `cliente_nome` + (`email`/`telefone`): oferecer **auto‑criação silenciosa** (mesmo caminho de `createClient`) usando os dados vindos do Studio, e selecionar o novo cliente. Mostrar toast: "Cliente vinculado automaticamente do Studio".
  - Se nem nome veio: toast amigável "Selecione o cliente manualmente" e não bloquear o resto.

### 2. Não bloquear processamento dos demais campos pelo gate de clientes

Hoje, se `clients.length === 0` e há `cliente_id`, o `useEffect` retorna inteiro — pacote/sessão/preço **também ficam pendentes**. Refatorar para:
- Processar pacote/categoria/sessão/preço imediatamente (não dependem de `clients`).
- Tratar a resolução do cliente como uma sub‑rotina assíncrona independente, com timeout (~3 s) antes de cair no fallback de busca direta no DB.

### 3. Hardening do `useGalleryClients`

- Logar `error.message` em caso de falha do `select` (hoje só `console.error` sem propagar).
- Expor um método `refetch()` (já existe) e novo `fetchClientById(id)` para busca pontual sem invalidar a lista.
- Cuidado para a query não estourar 1000 linhas: adicionar `.limit(2000)` explícito e, se vier ≥ 2000, fazer paginação ou usar busca direta por ID como já planejado.

### 4. Preservar query params no fluxo de login

`ProtectedRoute.tsx`: trocar `<Navigate to="/auth" replace />` por `<Navigate to={`/auth?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />` e, no `Auth.tsx`, após login bem‑sucedido, fazer `navigate(decodeURIComponent(redirect))` em vez de cair na Home. Isso blinda o caso "usuário deslogado clica no link do Studio".

### 5. Telemetria leve para diagnóstico futuro

- No `useEffect` do modo assistido, adicionar `console.warn` estruturado quando:
  - `cliente_id` veio mas não achou na lista (já existe — manter).
  - Fallback de DB também falhou.
  - Auto‑criação foi acionada.
- Esses logs ficam visíveis em sessões PWA via `console` para investigação rápida.

## Arquivos a alterar

- `src/pages/GalleryCreate.tsx` — split do `useEffect`, fallback de cliente, auto‑criação opcional.
- `src/hooks/useGalleryClients.ts` — novos `fetchClientById`, `addClientToCache`, `.limit(2000)`, logs melhores.
- `src/components/ProtectedRoute.tsx` — preservar `pathname + search` no redirect.
- `src/pages/Auth.tsx` — respeitar `?redirect=` após login.

## Fora do escopo

- Nenhuma mudança no Studio nem em edge functions de pagamento (InfinitePay, Asaas, Mercado Pago). Webhooks e cobranças permanecem intocados.
- Nenhuma mudança em RLS ou no banco.

## QA

1. Desktop logado, link do Studio com `cliente_id` válido → cliente já cacheado seleciona instantaneamente (regressão zero).
2. PWA mobile logado, link com `cliente_id` válido mas `clients` vazio inicialmente → fallback de DB busca e seleciona; demais campos não esperam pelo cliente.
3. Link com `cliente_id` inexistente mas `cliente_nome` + `cliente_email` → cria cliente, seleciona, toast informativo.
4. Link com só `cliente_nome` → form preenche pacote, deixa cliente vazio, toast pede seleção manual.
5. PWA mobile **deslogado** clica no link → `/auth?redirect=...` → após login cai em `/gallery/new` com todos os params intactos.
