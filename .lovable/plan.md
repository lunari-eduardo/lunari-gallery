

# Ordenação por Linhas (Esquerda para Direita)

## Problema Identificado

O CSS `column-count` utilizado atualmente distribui os itens **verticalmente** em cada coluna:

```text
ATUAL (column-count):           DESEJADO (CSS Grid):
┌─────┬─────┬─────┐             ┌─────┬─────┬─────┐
│  1  │  4  │  7  │             │  1  │  2  │  3  │
│  2  │  5  │  8  │             │  4  │  5  │  6  │
│  3  │  6  │  9  │             │  7  │  8  │  9  │
└─────┴─────┴─────┘             └─────┴─────┴─────┘
```

As fotos estão sendo ordenadas alfabeticamente corretamente no banco de dados, mas o `column-count` distribui da primeira para a última coluna de cima para baixo.

## Solução

Substituir `column-count` por CSS Grid, que distribui itens da esquerda para a direita naturalmente.

**Trade-off:** O layout "masonry" verdadeiro (onde fotos de alturas diferentes encaixam como tijolos) não é possível com CSS Grid puro. As fotos ficarão em uma grade uniforme com todas as linhas da mesma altura (baseada na foto mais alta daquela linha).

---

## Mudanças Técnicas

### Arquivo 1: `src/index.css`

Substituir `column-count` por `display: grid`:

```css
.masonry-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

@media (min-width: 640px) {
  .masonry-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1024px) {
  .masonry-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (min-width: 1280px) {
  .masonry-grid {
    grid-template-columns: repeat(5, 1fr);
  }
}

@media (min-width: 1536px) {
  .masonry-grid {
    grid-template-columns: repeat(6, 1fr);
  }
}

.masonry-item {
  /* Remover break-inside pois não se aplica a grid */
}
```

### Arquivo 2: `src/components/MasonryGrid.tsx`

Manter o componente como está - apenas o CSS muda.

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/index.css` | Substituir `column-count` por CSS Grid |

---

## Resultado Esperado

Fotos ordenadas alfabeticamente fluindo da esquerda para a direita:

```text
LISE2752 → LISE2754 → LISE2755 → LISE2756 → LISE2757 → LISE2758
    ↓
LISE2759 → LISE2760 → LISE2761 → LISE2762 → LISE2763 → LISE2764
    ↓
...e assim por diante
```

## Impacto

Esta mudança afeta todas as visualizações de galeria:
- Galeria do cliente (`ClientGallery.tsx`)
- Detalhe da galeria no painel do fotógrafo (`GalleryDetail.tsx`)
- Preview da galeria (`GalleryPreview.tsx`)

Todas passarão a exibir fotos em ordem de leitura natural (esquerda → direita, cima → baixo).

