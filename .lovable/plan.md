

# Correcao de Espacos Vazios no Grid de Fotos

## Problema

O CSS Grid atual tem colunas de largura igual, mas cada foto define sua propria `aspectRatio` baseada em `width/height`. Quando uma foto horizontal (ex: 1600x1000) fica ao lado de uma vertical (ex: 1000x1500), a horizontal ocupa menos altura, criando espacos vazios visiveis entre as linhas do grid.

## Solucao

Forcar todas as celulas do grid a terem a mesma proporcao (quadrado `1/1`) e usar `object-fit: cover` para preencher a celula, cortando as bordas excedentes. Isso elimina 100% dos espacos vazios e cria um grid denso e uniforme, como mostrado na segunda imagem de referencia.

## Mudancas

### 1. `src/components/PhotoCard.tsx`

- Remover `style={{ aspectRatio: \`${photo.width}/${photo.height}\` }}` do container
- Adicionar classe `aspect-square` ao container
- A imagem ja usa `object-cover`, entao o crop acontece automaticamente

### 2. `src/components/deliver/DeliverPhotoGrid.tsx`

- Adicionar `aspect-square` e `overflow-hidden` ao container de cada foto
- Adicionar `object-cover h-full` na tag `<img>` para preencher a celula uniformemente

### 3. `src/components/deliver/memory/MemoryPhotoSelector.tsx`

- Ja usa `aspect-square` e `object-cover` — nenhuma mudanca necessaria

## Resultado

Todas as fotos ocupam celulas quadradas uniformes. Fotos horizontais e verticais se encaixam lado a lado sem espacos. A ordem horizontal (1, 2, 3, 4...) e preservada.

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/components/PhotoCard.tsx` | Trocar aspectRatio dinamico por `aspect-square` |
| `src/components/deliver/DeliverPhotoGrid.tsx` | Adicionar `aspect-square` + `object-cover` uniforme |

