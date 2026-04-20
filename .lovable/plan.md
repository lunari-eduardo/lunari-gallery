

# Plano: Corrigir capa da galeria Transfer (cliente) e habilitar troca de capa na edição

## Diagnóstico

Após investigar o fluxo, encontrei **duas causas distintas**:

### Problema 1 — Capa não aparece para o cliente
- Na criação (`DeliverCreate.tsx`), a capa é salva corretamente em `galerias.configuracoes.coverPhotoId` (linhas 269-294).
- Mas a Edge Function `gallery-access` (linhas 195-216), ao montar o payload do tipo `deliver: true`, **não inclui** `coverPhotoId` no objeto `gallery.settings`. Só envia `sessionFont` e `titleCaseMode`.
- Resultado: `ClientDeliverGallery.tsx` (linha 106) lê `gallery.settings?.coverPhotoId` como `undefined` e usa sempre `allPhotos[0]` (a primeira foto) como capa.

### Problema 2 — Não há opção de capa na edição
- `DeliverDetail.tsx` (linhas 295-368, aba "Fotos") renderiza um grid **manual** que só tem botões de download e excluir.
- Não usa o componente `DeliverPhotoManager` (que tem a UI de "definir como capa") usado na criação.
- Também não há badge mostrando qual é a capa atual nem como trocá-la.

## Correções

### 1. Edge Function `gallery-access` — incluir `coverPhotoId` no payload do cliente

Em `supabase/functions/gallery-access/index.ts`, no bloco do `deliver: true` (linhas 204-207), adicionar:

```ts
settings: {
  sessionFont: galleryConfig?.sessionFont || undefined,
  titleCaseMode: galleryConfig?.titleCaseMode || 'normal',
  coverPhotoId: galleryConfig?.coverPhotoId || undefined, // ← novo
},
```

Isso resolve a persistência: capa escolhida na criação aparece imediatamente na galeria do cliente.

### 2. `DeliverDetail.tsx` — habilitar gerenciar capa na aba Fotos

Substituir o grid manual atual (linhas 320-354) por uma versão enriquecida que:

- Mantém todas as ações atuais (download, excluir).
- Adiciona um **botão de estrela** ("Definir como capa" / "Remover capa") em cada foto, no mesmo padrão visual do `DeliverPhotoManager`.
- Mostra **badge "CAPA"** sobre a foto atualmente definida como capa.
- Mostra contador no topo: `"X fotos entregues · 1 capa selecionada"` quando aplicável.

Estado e persistência:
- Ler `coverPhotoId` atual de `gallery.configuracoes.coverPhotoId` no `useEffect` de carregamento da galeria.
- Manter `coverPhotoId` em estado local (`useState`).
- Ao clicar em "Definir como capa": atualizar estado + persistir imediatamente via `updateGallery` mesclando com `gallery.configuracoes` (mesmo padrão da criação).
- Se a foto-capa for excluída: resetar `coverPhotoId` para `null` automaticamente e persistir.

UX:
- Botão de capa fica ao lado de download/excluir no overlay hover (ícone `Star` da lucide).
- Quando a foto é a capa: estrela amarela preenchida + ring amarelo discreto na borda + badge dourado "CAPA" no canto superior esquerdo.
- Toast de confirmação ("Capa atualizada" / "Capa removida").

### 3. Limpeza do `DeliverCreate.tsx` (opcional, mesma seção)

O arquivo já funciona — só salva. Vou confirmar que a chave gravada é exatamente `coverPhotoId` (camelCase) para bater com o que a Edge Function vai ler. Já está correto.

## Resultado esperado

- Capa definida na criação aparece na hero section da galeria do cliente.
- Capa pode ser alterada (ou removida) a qualquer momento na aba "Fotos" da edição da galeria Transfer.
- Mesma UX de seleção de capa em ambos os pontos (criação e edição).
- Capa atualizada propaga imediatamente para o cliente (sem precisar recriar a galeria).

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/gallery-access/index.ts` | Incluir `coverPhotoId` no `gallery.settings` retornado para galerias de entrega (deliver) |
| `src/pages/DeliverDetail.tsx` | Adicionar UI de seleção/troca de capa na aba "Fotos", com persistência imediata em `configuracoes.coverPhotoId` e proteção contra exclusão da capa |

