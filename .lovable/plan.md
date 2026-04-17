
# Plano: fazer a “Minha Marca” ficar realmente intercalada em 45° com o logo reto

## Diagnóstico
O comportamento atual continua “reto” porque a lógica usa apenas `brickOffset` em linhas horizontais. Isso cria um padrão intercalado simples, mas não um padrão diagonal real a 45°.

Para ficar como você pediu, não basta deslocar meia coluna: é preciso mudar a malha de posicionamento inteira para um eixo rotacionado em 45°, mantendo cada logo sem rotação.

## O que vou ajustar

### 1. Corrigir o algoritmo da distribuição no upload
**Arquivo:** `src/lib/imageCompression.ts`

No modo `custom`:
- remover a ideia de grid horizontal com offset simples
- calcular as posições em uma malha diagonal de 45°
- manter o logo em `0°`
- aplicar o intercalamento por linha nessa malha diagonal

Abordagem:
- definir um ângulo fixo de 45°
- gerar linhas/colunas em um “espaço rotacionado”
- converter cada ponto para coordenadas reais do canvas
- desenhar o logo reto em cada ponto calculado

Em termos práticos:
```ts
screenX = centerX + rotatedX * cos - rotatedY * sin
screenY = centerY + rotatedX * sin + rotatedY * cos
```

Com isso:
- o padrão fica diagonal de verdade
- o logo continua reto
- o intercalamento aparece visualmente

### 2. Preservar escala e densidade já aprovadas
Ainda em `src/lib/imageCompression.ts`:
- manter os tamanhos base atuais (`small`, `medium`, `large`)
- manter a densidade mais fechada
- ajustar apenas o espaçamento fino se necessário para o 45° não abrir “buracos” visuais

### 3. Garantir cobertura total das bordas
O grid diagonal precisa de área extra de desenho.
Vou ampliar os limites de geração das marcas para cobrir:
- cantos
- laterais
- topo e base

Isso evita que o padrão fique “cortado” nas bordas após a rotação da malha.

### 4. Corrigir o preview para refletir o resultado real
**Arquivo:** `src/components/settings/WatermarkUploader.tsx`

O preview atual com `background-repeat` nunca vai representar corretamente:
- intercalamento
- diagonal real em 45°
- distribuição equivalente ao canvas

Então vou substituir o preview visual por renderização real dos tiles no componente:
- container com `position: relative`
- vários elementos/imagens absolutas
- mesmas posições calculadas pelo algoritmo do upload
- opacidade e tamanho sincronizados com os controles

## Melhor abordagem de UX
Para evitar divergência entre preview e upload real, vou centralizar a matemática de layout em uma função reutilizável, por exemplo:
- `getWatermarkTileLayout(...)`

Essa função será usada por:
- `imageCompression.ts` para gravar na foto
- `WatermarkUploader.tsx` para mostrar o preview

Assim o usuário vê exatamente o mesmo padrão que será aplicado no upload.

## Arquivos envolvidos
- `src/lib/imageCompression.ts` — trocar grid horizontal por malha diagonal 45° com logos retos
- `src/components/settings/WatermarkUploader.tsx` — substituir preview por renderização real intercalada
- opcionalmente um util compartilhado, se fizer sentido:
  - `src/lib/watermarkLayout.ts`

## Resultado esperado
- logos retos, sem distorção
- distribuição realmente diagonal em 45°
- linhas intercaladas visivelmente
- sem alinhamento “lado a lado” em colunas retas
- preview fiel ao resultado final do upload
