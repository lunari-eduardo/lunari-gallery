# Correção das Predefinições de Faixas de Desconto

## Diagnóstico

Investiguei o fluxo do botão "Salvar" das faixas progressivas em `src/pages/GalleryCreate.tsx`:

- O botão abre um diálogo que pede o nome da predefinição e chama `savePreset()` (linha 1129).
- `savePreset()` tenta persistir via `updateSettings({ discountPresets: [...] })`.
- **Bug confirmado:** a mutação genérica `updateSettings` em `src/hooks/useGallerySettings.ts` (linhas ~270–360) só processa colunas da tabela `gallery_settings` e **ignora silenciosamente o campo `discountPresets`**. Resultado: nada é gravado no banco, nenhum toast é exibido e o diálogo fecha como se tivesse funcionado.
- Já existe a tabela `gallery_discount_presets` e as mutações corretas no hook: `createDiscountPreset`, `updateDiscountPreset`, `deleteDiscountPreset` — elas simplesmente não estão sendo usadas pela tela.
- Não existe nenhuma lista visível das predefinições salvas com nome. Hoje só há um `<Select>` "Carregar" que aparece dentro do bloco, sem nomes em destaque e sem permitir renomear/excluir.

Também identifiquei o badge "Novo" no card "Pacotes com descontos" (linha 1543–1545 de `GalleryCreate.tsx`) que deve ser removido.

## Escopo da Correção

Mudanças apenas de UI + ligação correta com mutations já existentes. **Nada na lógica de precificação, regras congeladas, cobrança, webhooks ou edge functions será tocado.**

### 1. Corrigir o salvamento real (GalleryCreate.tsx)
- Importar `createDiscountPreset`, `updateDiscountPreset`, `deleteDiscountPreset` do `useGallerySettings` (atualmente o hook `useSettings` não expõe — adicionar passagem ou consumir `useGallerySettings` diretamente nesta tela).
- Reescrever `savePreset()` para chamar `createDiscountPreset.mutate({ name, packages })` com `onSuccess` exibindo toast "Predefinição salva" e fechando o diálogo, e `onError` com toast de erro.
- Validar nome duplicado antes de salvar (case-insensitive) e bloquear com mensagem amigável.

### 2. Lista visível de predefinições salvas
Substituir o `<Select>` "Carregar" por uma seção compacta dentro do bloco "Configurar faixas" mostrando cada predefinição salva como uma linha com:
- Nome da predefinição (negrito).
- Resumo curto: "Nx faixas · R$ menor–maior".
- Botões de ação: **Carregar** (aplica as faixas), **Renomear** (abre diálogo), **Excluir** (com confirmação).

Quando não houver nenhuma predefinição salva, mostrar um placeholder discreto: "Nenhuma predefinição salva". Quando o usuário salvar a primeira, a lista aparece imediatamente (já temos invalidação de `queryKey: ['gallery-settings']` nas mutations).

Layout (desktop):
```text
Configurar faixas                    [Salvar] [+ Adicionar]
┌──────────────────────────────────────────────────────────┐
│ Faixas atuais (editáveis)                                │
│  De 1 — Até ∞ — R$ 20  🗑                                │
└──────────────────────────────────────────────────────────┘

Predefinições salvas
┌──────────────────────────────────────────────────────────┐
│ Casamentos · 3 faixas · R$ 15–25     Carregar ✎ 🗑      │
│ Ensaios   · 2 faixas · R$ 18–22      Carregar ✎ 🗑      │
└──────────────────────────────────────────────────────────┘
```

No mobile, mesma estrutura empilhada com ações em ícone.

### 3. Mesma melhoria no GalleryEdit
`src/pages/GalleryEdit.tsx` (linhas ~665–682) tem o mesmo `<Select>` de carregar preset, sem botão de salvar atual. Aplicar a mesma lista compacta de "Predefinições salvas" + botão "Salvar atual como predefinição" reutilizando o diálogo, para paridade entre as duas telas.

### 4. Remover badge "Novo"
Remover o `<Badge>` "Novo" das linhas 1543–1545 de `GalleryCreate.tsx` (e checar se existe equivalente em `GalleryEdit.tsx` — caso exista, remover também).

## Segurança / Não-Quebra

- A tabela `gallery_discount_presets` já existe com RLS por `user_id` — nenhuma migração necessária.
- As mutations `createDiscountPreset/update/delete` já invalidam o cache `gallery-settings`, portanto a UI atualiza sozinha.
- O formato dos `packages` salvos (`DiscountPackage[]`) é idêntico ao já usado em `buildRegrasFromDiscountPackages`, então "Carregar" continua compatível com toda a lógica de regras congeladas e progressive pricing existente.
- Não mexer em: `pricingUtils.ts`, `confirm-selection`, `client-selection`, qualquer edge function de pagamento (InfinitePay, Asaas, Mercado Pago), `finalize_gallery_payment` RPC, ou cálculo de extras/cobranças.

## Arquivos a Editar
- `src/pages/GalleryCreate.tsx` — corrigir `savePreset`, adicionar lista + renomear/excluir, remover badge "Novo".
- `src/pages/GalleryEdit.tsx` — adicionar lista + botão de salvar, paridade com Create.
- `src/hooks/useSettings.ts` *(opcional)* — repassar `createDiscountPreset/update/delete` se preferirmos manter consumo via `useSettings`. Alternativa: consumir `useGallerySettings` direto nas duas telas.

## QA Manual após implementar
1. Criar predefinição com nome → aparece na lista, persiste após refresh.
2. Tentar nome duplicado → bloqueio com toast.
3. Carregar predefinição → faixas substituem as atuais corretamente.
4. Renomear → nome atualizado na lista.
5. Excluir → some da lista, confirmar via refresh.
6. Selecionar predefinição e finalizar criação da galeria → `regras_congeladas` corretas no banco (sem alteração de comportamento).
7. Badge "Novo" não aparece mais no card "Pacotes com descontos".
