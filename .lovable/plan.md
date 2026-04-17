

# Plano: Corrigir alinhamento do brick offset (intercalar linhas)

## Problema

Na imagem enviada, todos os logos estão alinhados verticalmente (em colunas), formando um grid reto. O brick offset (deslocamento de meia-coluna em linhas alternadas) não está aparecendo.

## Causa raiz

Em `src/lib/imageCompression.ts`, o loop interno começa em `startX - spacingX` e itera em todas as linhas com o mesmo passo `spacingX`. O `brickOffset` (0 ou `spacingX/2`) é aplicado, mas como o `diagonalOffset` cresce linearmente em **todas** as linhas pelo mesmo incremento, ele anula visualmente a alternância — todos os logos acabam recaindo no mesmo grid.

Além disso, o `diagonalOffset` somado em cada linha está empurrando todo o padrão para a direita, desalinhando o efeito brick.

## Correção

Em `src/lib/imageCompression.ts`, dentro do bloco `mode === 'custom'` da função `applyWatermark`:

1. **Remover o `diagonalOffset` progressivo** — ele está mascarando o brick offset e empurrando tudo para um lado
2. **Manter apenas o `brickOffset`** alternando por linha (`rowIndex % 2`)
3. Ajustar bounds para garantir cobertura nas bordas mesmo com o offset de meia-coluna

```typescript
let rowIndex = 0;
for (let ty = startY; ty < endY; ty += spacingY) {
  // Brick offset puro: linhas pares começam em 0, ímpares deslocam metade
  const xOffset = (rowIndex % 2 === 0) ? 0 : spacingX / 2;

  for (let tx = startX; tx < endX; tx += spacingX) {
    ctx.drawImage(watermarkImg, tx + xOffset, ty, tileWidth, tileHeight);
  }
  rowIndex++;
}
```

E ajustar bounds:
```typescript
const startX = -spacingX;       // garante cobertura à esquerda mesmo com offset
const startY = -spacingY;
const endX = width + spacingX;  // sem multiplicar por 2 (não há mais drift)
const endY = height + spacingY;
```

## Resultado

- Padrão **brick/intercalado real** (linhas pares vs ímpares deslocadas em meia-coluna)
- Logos retos (0°), tamanho e densidade preservados
- Cobertura uniforme borda a borda

## Arquivo modificado

| Arquivo | Mudança |
|---|---|
| `src/lib/imageCompression.ts` | Remover `diagonalOffset` progressivo; manter apenas `brickOffset` alternado por linha |

