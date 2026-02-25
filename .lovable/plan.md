

# Masonry Real com CSS Columns

## Problema

O layout atual usa CSS Grid com `grid-auto-rows: 10px` e row spans calculados. Isso causa distorcao porque as imagens usam `object-cover` com `h-full` dentro de containers de altura fixa (spans), cortando e esticando as fotos. Nao e um masonry real.

## Solucao

Substituir completamente por CSS `column-count`. E a abordagem mais simples e nativa para masonry real:

- Cada imagem usa `width: 100%` e `height: auto` — proporcao original preservada
- `column-count` distribui as fotos em colunas verticais automaticamente
- `break-inside: avoid` impede que uma foto seja dividida entre colunas
- Zero distorcao, zero corte, zero espacos vazios

A ordenacao visual sera por coluna (cima para baixo, coluna por coluna), nao por linha. Isso e o comportamento padrao e esperado de um masonry real — e exatamente o que plataformas de fotografia profissional usam.

## Mudancas

### 1. `src/index.css` — CSS Columns

Substituir o grid por column-count:

```css
.masonry-grid {
  column-count: 2;
  column-gap: 6px;
}

@media (min-width: 640px) {
  .masonry-grid { column-count: 3; }
}

@media (min-width: 1280px) {
  .masonry-grid { column-count: 4; }
}

.masonry-item {
  break-inside: avoid;
  margin-bottom: 6px;
}
```

Remover `display: grid`, `grid-template-columns`, `grid-auto-rows`, `gap`.

### 2. `src/components/MasonryGrid.tsx` — Simplificar MasonryItem

Remover toda a logica de row span (`BASE_SPAN`, `GAP_COMPENSATION`, `useMemo`, `gridRowEnd`). O `MasonryItem` passa a ser apenas um wrapper com `break-inside: avoid` (via classe CSS). Manter as props `photoWidth`/`photoHeight` para nao quebrar chamadas existentes, mas nao usa-las.

### 3. `src/components/PhotoCard.tsx` — Imagem com proporcao natural

Trocar `w-full h-full object-cover` por `w-full h-auto block` na tag `<img>`. Remover `h-full` do container. A imagem renderiza na sua proporcao original.

### 4. `src/components/deliver/DeliverPhotoGrid.tsx` — Mesma correcao

Trocar `w-full h-full object-cover` por `w-full h-auto block` na `<img>`. Remover `h-full` do container.

### 5. `src/pages/ClientGallery.tsx` — Corrigir grid de fotos confirmadas

Na secao de fotos confirmadas (linha ~1140), trocar `w-full h-full` por classes compatíveis e a `<img>` para `w-full h-auto`.

### 6. `src/components/FinalizedPreviewScreen.tsx` — Ja usa `h-auto`

Nenhuma mudanca necessaria — ja usa `w-full h-auto object-cover`.

## Performance

- `loading="lazy"` ja presente nas galerias Deliver; adicionar no PhotoCard
- Skeleton/placeholder ja implementado no PhotoCard (pulse animation)
- Fade-in ja implementado no PhotoCard (opacity transition on load)

## Arquivos

| Arquivo | Acao |
|---|---|
| `src/index.css` | Trocar grid por column-count |
| `src/components/MasonryGrid.tsx` | Remover logica de row span |
| `src/components/PhotoCard.tsx` | `h-auto` na imagem, remover `h-full` |
| `src/components/deliver/DeliverPhotoGrid.tsx` | `h-auto` na imagem, remover `h-full` |
| `src/pages/ClientGallery.tsx` | Corrigir container de fotos confirmadas |

