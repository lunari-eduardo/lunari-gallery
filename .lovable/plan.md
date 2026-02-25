

# Masonry com Ordem Horizontal via JS (Shortest Column Algorithm)

## Problema

CSS `column-count` preenche de cima para baixo em cada coluna, resultando em ordem vertical (1,2,3 na coluna 1, depois 4,5,6 na coluna 2). O usuario precisa de ordem horizontal (1,2,3,4 na primeira "linha visual", depois 5,6,7,8).

## Solucao

Implementar masonry via JavaScript no componente `MasonryGrid`. O algoritmo:

1. Receber as fotos como children com metadata de `photoWidth`/`photoHeight`
2. Para cada child, calcular o aspect ratio
3. Inserir na coluna com menor altura acumulada
4. Renderizar como colunas flexbox lado a lado

Isso preserva a ordem horizontal natural porque a foto 1 vai para coluna 1 (menor), foto 2 para coluna 2 (menor), foto 3 para coluna 3, foto 4 para coluna 4, e na sequencia a foto 5 vai para a coluna que tiver menor altura — criando leitura natural da esquerda para direita.

## Mudancas

### 1. `src/components/MasonryGrid.tsx` — Reescrever com logica JS

- `MasonryGrid` recebe `items` (array de objetos com `id`, `width`, `height`, `content`) em vez de `children`
- Usa `useState` + `useEffect` para calcular numero de colunas baseado em window width (2/3/4)
- Distribui items nas colunas pelo algoritmo de menor altura acumulada
- Renderiza como `div` flex com colunas independentes
- Cada coluna e um `div` vertical com gap

Alternativa mais simples (sem breaking change): manter `children` como `ReactElement[]`, extrair `photoWidth`/`photoHeight` das props de cada child (`MasonryItem`), e distribuir os children nas colunas. Isso evita mudar todos os consumidores.

### 2. `src/index.css` — Remover column-count

Remover `column-count`, `column-gap`, `break-inside: avoid` das classes `.masonry-grid` e `.masonry-item`. Substituir por estilos flexbox simples (ou inline no componente).

### 3. Demais arquivos — Nenhuma mudanca

`PhotoCard.tsx`, `DeliverPhotoGrid.tsx`, `ClientGallery.tsx`, `GalleryDetail.tsx`, `GalleryPreview.tsx`, `FinalizedPreviewScreen.tsx` continuam passando `photoWidth`/`photoHeight` ao `MasonryItem` — nenhuma alteracao necessaria.

## Detalhes Tecnicos

```text
Algoritmo de distribuicao:

Fotos: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
Colunas: 4

Passo 1: Colunas vazias [0, 0, 0, 0]
  Foto 1 → Col 0 (menor)  → [h1, 0, 0, 0]
  Foto 2 → Col 1 (menor)  → [h1, h2, 0, 0]
  Foto 3 → Col 2 (menor)  → [h1, h2, h3, 0]
  Foto 4 → Col 3 (menor)  → [h1, h2, h3, h4]

Passo 2: Proxima foto vai para coluna mais curta
  Foto 5 → Col com menor altura acumulada
  ...

Resultado visual: ordem horizontal preservada
```

Responsividade via `ResizeObserver` ou `matchMedia`:
- `< 640px` → 2 colunas
- `640px - 1279px` → 3 colunas  
- `>= 1280px` → 4 colunas

Quando o numero de colunas muda, redistribui todas as fotos.

## Arquivos

| Arquivo | Acao |
|---|---|
| `src/components/MasonryGrid.tsx` | Reescrever com algoritmo JS de menor coluna |
| `src/index.css` | Remover column-count, usar flex para colunas |

