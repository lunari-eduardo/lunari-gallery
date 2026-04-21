

# Plano: feedback de clique nos botões de navegação entre etapas

## Problema

No `GalleryCreate`, os botões "Voltar", "Salvar Rascunho" e "Próximo / Criar Galeria" às vezes levam meio segundo a um segundo para reagir porque:

- no passo 3 → 4, `handleNext` faz `await createSupabaseGalleryForUploads()` (criação no Supabase);
- no passo 6, `handleNext` faz `await updateGallery(...)` + `await publishSupabaseGallery(...)` antes de navegar;
- `handleSaveDraft` também é assíncrono.

Sem feedback, o usuário fica em dúvida se clicou. Hoje os 3 botões nem viram `disabled`, então o usuário pode clicar várias vezes (risco de duplicar criação/publicação).

## Solução

Adicionar 3 sinais de feedback aos botões da barra fixa de navegação (`src/pages/GalleryCreate.tsx`, linhas 2082-2104):

### 1. Pressionado (microinteração imediata)

Aplicar `active:scale-[0.97] transition-transform duration-150` nos 3 botões. Resposta visual imediata no `mousedown`/`touchstart`, sem esperar nada assíncrono.

### 2. Estado "carregando" durante operação assíncrona

Criar 3 estados locais:
- `isAdvancing` (true durante `handleNext` async)
- `isGoingBack` (true durante `handleBack`, mesmo que síncrono — animação curta de 200ms para feedback)
- `isSavingDraft` (true durante `handleSaveDraft`)

Em cada handler:
```text
setIsAdvancing(true);
try { ...await... } finally { setIsAdvancing(false); }
```

Nos botões, quando o respectivo estado for true:
- trocar o ícone (`ArrowRight`, `ArrowLeft`, `Save`) por `Loader2 className="animate-spin"`;
- texto muda contextualmente:
  - "Próximo" → "Avançando..."
  - "Criar Galeria" → "Criando galeria..." (passo 6)
  - "Voltar" → "Voltando..."
  - "Salvar Rascunho" → "Salvando..."
- aplicar `disabled` em **todos os 3 botões** ao mesmo tempo enquanto qualquer operação está em curso (evita cliques cruzados);
- `cursor-wait` no botão ativo.

### 3. Guard contra duplo clique

O `disabled` global durante `isAdvancing || isSavingDraft` já previne o duplo `await createSupabaseGalleryForUploads()` ou duplo publish que poderia acontecer hoje em conexões lentas — ganho de robustez sem mudança no fluxo.

## Detalhes técnicos

| Arquivo | Mudança |
|---|---|
| `src/pages/GalleryCreate.tsx` | adicionar `useState` para `isAdvancing`, `isGoingBack`, `isSavingDraft`; envolver `handleNext`, `handleBack` (com timeout curto de 200ms) e `handleSaveDraft` em `try/finally` que alterna o estado; importar `Loader2` do lucide-react; reescrever JSX dos 3 botões (linhas 2085-2101) com ícone condicional, texto dinâmico, `disabled` cruzado e classes `active:scale-[0.97] transition-transform duration-150 cursor-wait`(quando ativo) |
| Sem alteração em | lógica de criação/publicação, `useSupabaseGalleries`, edge functions, fluxos de pagamento, `prepare_gallery_share`, validações de etapa, navegação ao final |

## Validação

1. clicar "Próximo" no passo 3 → botão escurece levemente (active scale), ícone vira spinner, texto vira "Avançando...", todos os 3 botões ficam desabilitados; ao concluir, etapa avança e botões reativam;
2. clicar "Voltar" → microanimação de 200ms; volta etapa;
3. clicar "Salvar Rascunho" → spinner + "Salvando..."; toast normal ao finalizar;
4. clicar "Criar Galeria" no passo 6 → "Criando galeria..." até navegar para `/gallery/:id`;
5. tentar clicar várias vezes seguidas em "Próximo" → o segundo clique é ignorado (botão desabilitado);
6. fluxo Gestão (`?session_id=...`) idem;
7. `npm run build` sem erros TS.

## Resultado esperado

O usuário recebe resposta visual instantânea em qualquer botão de navegação, vê claramente quando uma operação assíncrona está em andamento, e fica protegido contra cliques duplicados que poderiam disparar duas criações ou publicações da mesma galeria.

