

# Plano: Corrigir rotação, escala e densidade da marca d'água tile

## Problema
Atualmente o logo é rotacionado individualmente em -45°, distorcendo a identidade visual. Além disso, marca pequena e espaços vazios entre repetições.

## Correção em `src/lib/imageCompression.ts`

### 1. Rotação: padrão diagonal, logo reto

Trocar a abordagem atual (rotacionar o canvas inteiro antes de desenhar) por **offset diagonal por linha**, mantendo `ctx.rotate(0)`:

- Remover `ctx.rotate(-45 * Math.PI / 180)` 
- Para cada linha do grid, aplicar offset horizontal incremental criando padrão diagonal natural
- Cada `drawImage` desenha o logo na orientação original (0°)

**Lógica:**
```typescript
// Sem rotação do canvas - logo permanece reto
let rowIndex = 0;
for (let ty = startY; ty < endY; ty += spacingY) {
  // Offset diagonal: cada linha desloca pela metade do spacingX
  const xOffset = (rowIndex % 2 === 0) ? 0 : spacingX / 2;
  // Offset progressivo adicional para padrão diagonal contínuo
  const diagonalOffset = (ty / spacingY) * (spacingX * 0.3);
  
  for (let tx = startX - spacingX; tx < endX + spacingX; tx += spacingX) {
    ctx.drawImage(watermarkImg, tx + xOffset + diagonalOffset, ty, tileWidth, tileHeight);
  }
  rowIndex++;
}
```

Isso gera um padrão visual diagonal (mais bonito que grid reto), com o logo sempre reto.

### 2. Aumentar tamanho base

Atualizar `scaleFactor`:
```typescript
// Antes: small=0.12, medium=0.18, large=0.26
// Depois: tamanho base aumentado conforme regra (+30%, +60%)
const scaleFactor = 
  tileScale === 'small'  ? 0.16 :   // base
  tileScale === 'large'  ? 0.34 :   // +60% sobre médio (~0.21 base)
                            0.21;   // medium = small +30%
```

### 3. Densidade: reduzir espaçamento

Atualizar multiplicadores de espaçamento para evitar buracos visuais:
```typescript
// Antes: spacingX = tileWidth * 1.6, spacingY = tileHeight * 2.0
const spacingX = tileWidth * 1.25;   // mais denso horizontal
const spacingY = tileHeight * 1.5;   // mais denso vertical
```

### 4. Cobertura de bordas

Como removemos a rotação do canvas, não precisamos mais estender bounds em ~70% da diagonal. Basta:
```typescript
const startX = -spacingX;
const startY = -spacingY;
const endX = width + spacingX * 2;   // margem extra para offset diagonal
const endY = height + spacingY;
```

Garante que as marcas cubram da borda esquerda à direita, incluindo o offset diagonal progressivo.

## Atualização do preview em `WatermarkUploader.tsx`

Replicar o mesmo comportamento via CSS para fidelidade total:
- Remover `transform: rotate(-45deg)` do elemento com `backgroundImage`
- Usar `background-image` com `background-repeat: repeat` (logo reto)
- Adicionar `background-position` calculado para simular o offset diagonal: usar `transform: skewY(-15deg)` leve OU manter `repeat` simples (CSS não consegue replicar offset progressivo perfeitamente, mas o `repeat` reto com tile maior será visualmente próximo)

Decisão pragmática: preview usa `background-repeat: repeat` sem rotação, com `backgroundSize` baseado no scale. É uma aproximação fiel suficiente — o resultado real (canvas) é o que importa.

Atualizar mapeamento de `tilePx` no preview:
```typescript
// Antes: small=60, medium=90, large=130
const tilePx = scale <= 15 ? 80 : scale >= 40 ? 170 : 110;
```

## Resultado esperado

- Logo **sempre reto** (orientação original preservada)
- Padrão **diagonal natural** via offset progressivo entre linhas
- Marca **maior e mais presente** (Pequeno = atual, Médio +30%, Grande +60%)
- **Sem áreas vazias grandes** (espaçamento reduzido para 1.25x e 1.5x)
- Cobertura **borda a borda** garantida
- Modo `system` (centralizado) **inalterado**

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/lib/imageCompression.ts` | Remover rotação do canvas; offset diagonal por linha; novos `scaleFactor` e `spacing` |
| `src/components/settings/WatermarkUploader.tsx` | Remover `rotate(-45deg)` do preview; aumentar `tilePx` |

