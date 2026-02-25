

# Correcao: Fotos com Proporcao Original no Grid (Masonry via Grid Spans)

## Problema

A correcao anterior forcou `aspect-square` em todas as fotos, cortando horizontais e verticais para quadrados. O usuario quer que cada foto mantenha sua proporcao original (horizontal fica horizontal, vertical fica vertical) mas sem deixar espacos vazios entre elas.

## Solucao: CSS Grid com Row Spans Dinamicos

Usar `grid-auto-rows` com um valor base pequeno (ex: 10px) e calcular `grid-row: span N` para cada foto baseado na sua proporcao real. Isso mantem a ordenacao horizontal (esquerda para direita) enquanto permite alturas diferentes sem espacos.

```text
Exemplo com 4 colunas:
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  Foto 1  │ │  Foto 2  │ │          │ │  Foto 4  │
│ (horiz.) │ │ (horiz.) │ │  Foto 3  │ │ (horiz.) │
└──────────┘ └──────────┘ │ (vert.)  │ └──────────┘
┌──────────┐ ┌──────────┐ │          │ ┌──────────┐
│          │ │  Foto 6  │ └──────────┘ │          │
│  Foto 5  │ │ (horiz.) │ ┌──────────┐ │  Foto 8  │
│ (vert.)  │ └──────────┘ │  Foto 7  │ │ (vert.)  │
│          │ ┌──────────┐ │ (horiz.) │ │          │
└──────────┘ │  ...     │ └──────────┘ └──────────┘
```

Cada foto ocupa spans proporcionais a sua altura relativa. O grid preenche os espacos automaticamente.

## Mudancas

### 1. `src/index.css` — Grid com auto-rows

Trocar o grid atual por `grid-auto-rows: 10px` para permitir alturas granulares:

```css
.masonry-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-auto-rows: 10px;
  gap: 6px;
}
```

Breakpoints responsivos mantidos (3 colunas em sm/md/lg, 4 em 2xl).

### 2. `src/components/MasonryGrid.tsx` — MasonryItem com span dinamico

Adicionar props `photoWidth` e `photoHeight` ao `MasonryItem`. Calcular `gridRowEnd: span N` onde N e baseado na proporcao da foto. Fotos verticais recebem mais spans, horizontais menos.

Calculo: `spans = Math.round(baseSpan / aspectRatio) + 1` onde baseSpan ~= 25 (para colunas de ~250px de base).

### 3. `src/components/PhotoCard.tsx` — Remover aspect-square

Remover `aspect-square` do container. Usar `w-full h-full object-cover` para a imagem preencher o espaco determinado pelo span do pai.

### 4. `src/components/deliver/DeliverPhotoGrid.tsx` — Remover aspect-square

Mesmo ajuste: remover `aspect-square`, usar `w-full h-full object-cover`. Passar `photoWidth/photoHeight` ao MasonryItem.

### 5. Paginas que usam MasonryItem com PhotoCard

`ClientGallery.tsx`, `GalleryDetail.tsx`, `GalleryPreview.tsx` — passar `photoWidth={photo.width}` e `photoHeight={photo.height}` ao MasonryItem.

## Arquivos

| Arquivo | Acao |
|---|---|
| `src/index.css` | `grid-auto-rows: 10px` nas classes masonry |
| `src/components/MasonryGrid.tsx` | MasonryItem aceita width/height, calcula row span |
| `src/components/PhotoCard.tsx` | Remover `aspect-square`, usar `h-full` |
| `src/components/deliver/DeliverPhotoGrid.tsx` | Remover `aspect-square`, passar dimensoes |
| `src/pages/ClientGallery.tsx` | Passar width/height ao MasonryItem |
| `src/pages/GalleryDetail.tsx` | Passar width/height ao MasonryItem |
| `src/pages/GalleryPreview.tsx` | Passar width/height ao MasonryItem |

