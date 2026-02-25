

# Correcao da Ordenacao de Fotos no Grid

## Problema

O layout atual usa CSS `column-count` (masonry via CSS Columns). Esse metodo preenche cada coluna de cima para baixo antes de passar para a proxima coluna. Com 4 colunas e 10 fotos, a ordem fica:

```text
CSS Columns (atual - errado):
Col1: 1, 5, 9
Col2: 2, 6, 10
Col3: 3, 7
Col4: 4, 8

Leitura visual horizontal: 1, 2, 3, 4, 5, 6, 7, 8...  ← NAO e isso que acontece
Leitura real: 1, 5, 9, 2, 6, 10, 3, 7, 4, 8  ← embaralhado
```

## Solucao

Substituir `column-count` por `display: grid` com `grid-template-columns`. O CSS Grid preenche naturalmente da esquerda para a direita, linha por linha, garantindo a ordem correta.

```text
CSS Grid (correto):
Linha 1: 1, 2, 3, 4
Linha 2: 5, 6, 7, 8
Linha 3: 9, 10
```

As fotos perdem o efeito masonry de alturas variadas (que causava o problema), mas ganham ordenacao correta e visual limpo. Cada foto sera exibida com sua proporcao original dentro da celula do grid.

## Mudancas

### 1. `src/index.css` - Substituir masonry por CSS Grid

Trocar toda a definicao de `.masonry-grid` e `.masonry-item`:

```css
.masonry-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

@media (min-width: 640px) {
  .masonry-grid { grid-template-columns: repeat(3, 1fr); }
}

@media (min-width: 1024px) {
  .masonry-grid { grid-template-columns: repeat(3, 1fr); }
}

@media (min-width: 1280px) {
  .masonry-grid { grid-template-columns: repeat(3, 1fr); }
}

@media (min-width: 1536px) {
  .masonry-grid { grid-template-columns: repeat(4, 1fr); }
}

.masonry-item {
  /* break-inside removido - nao necessario com grid */
}
```

### 2. Componentes - Nenhuma mudanca

`MasonryGrid`, `MasonryItem`, `DeliverPhotoGrid`, `ClientGallery`, `GalleryPreview`, `GalleryDetail`, `FinalizedPreviewScreen` - todos continuam usando as mesmas classes CSS. A correcao e puramente no CSS.

## Impacto

Todas as galerias (Select e Transfer) sao corrigidas simultaneamente pois compartilham as mesmas classes CSS.

## Arquivos

| Arquivo | Acao |
|---|---|
| `src/index.css` | Substituir `column-count` por `display: grid` nas classes masonry |

