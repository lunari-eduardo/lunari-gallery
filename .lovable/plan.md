

# Evolucao do Modulo Lembranca: 10 Fotos, Multi-Layout e Video Colagem

## Resumo

Expandir o modulo para aceitar ate 10 fotos, com divisao automatica inteligente para layouts de imagem, selecao de foto destaque, e novo modo de video colagem animada para 6+ fotos.

---

## 1. Selecao expandida para 10 fotos

**Arquivo: `MemoryPhotoSelector.tsx`**
- Alterar maxSelection padrao de 4 para 10
- Adicionar funcionalidade de "foto destaque": ao dar um segundo tap numa foto ja selecionada, ela se torna destaque (indicador visual diferente, ex: estrela dourada em vez de check)
- Apenas 1 foto destaque por vez

**Arquivo: `MemoryCreator.tsx`**
- Remover logica condicional de maxSelection por outputType (sempre 10)
- Novo estado: `highlightId: string | null` -- a foto escolhida como destaque
- Passar highlightId para MemoryCanvas e MemoryVideoPreview

---

## 2. Layouts de imagem com divisao automatica

**Arquivo: `MemoryCanvas.tsx`** -- reescrever logica de renderizacao

**Regra de divisao:**
- 1-5 fotos: gera 1 imagem (layout unico)
- 6-10 fotos: gera automaticamente 2 imagens (divide fotos pela metade)

**Layouts disponiveis (substituem os atuais solo/dupla/colagem):**

Para cada bloco de fotos (1-5), o layout e automatico baseado na quantidade:

| Fotos no bloco | Layout |
|---|---|
| 1 | Foto unica centralizada + frase |
| 2 | 2 fotos empilhadas, destaque ocupa 60% da altura |
| 3 | Destaque grande (esquerda 60% largura), 2 menores empilhadas a direita |
| 4 | Destaque grande no topo (60% altura), 3 fotos embaixo lado a lado |
| 5 | Destaque grande (esquerda 60%), grid 2x2 a direita |

Se a foto destaque esta no bloco, ela recebe a posicao maior. Se nao ha destaque, a primeira foto do bloco assume.

**Para 6-10 fotos:** o sistema divide automaticamente em 2 blocos e gera 2 PNGs. O preview mostra ambas imagens em sequencia com swipe/scroll. Os botoes "Salvar" e "Compartilhar" exportam ambas.

**Arquivo: `MemoryLayoutPicker.tsx`**
- Remover os botoes solo/dupla/colagem (o layout agora e automatico)
- Manter apenas o toggle Imagem/Video
- Mostrar texto explicativo baseado na quantidade de fotos: "Sera gerada 1 imagem" ou "Serao geradas 2 imagens"

---

## 3. Video Colagem Animada (6-10 fotos)

**Arquivo: `MemoryVideoEngine.ts`** -- adicionar novo modo `collage`

**Logica de decisao automatica:**
- 1-5 fotos: modo slideshow (existente, sem alteracoes)
- 6-10 fotos: modo colagem animada

**Modo colagem animada:**
- Canvas 1080x1920 dividido em quadros fixos
- Cada quadro exibe uma foto com movimento lento independente
- Duracao: 8-10 segundos
- Frase aparece centralizada com overlay semi-transparente no meio do video

**Layouts de grid por quantidade:**

| Fotos | Grid | Disposicao |
|---|---|---|
| 6 | 2x3 | 2 colunas, 3 linhas |
| 7 | Assimetrico | 1 grande (topo 40%) + 3+3 embaixo |
| 8 | 2x4 | 2 colunas, 4 linhas |
| 9 | 3x3 | Grid uniforme |
| 10 | Assimetrico | 2 grandes (topo) + 2 fileiras de 4 |

**Movimentos sutis por quadro (independentes):**
Cada foto recebe um dos 3 movimentos aleatorios (seed baseado no index):
- Zoom lento: 1.0x a 1.04x (metade do Ken Burns normal)
- Pan horizontal: deslocamento de 0 a 20px
- Pan vertical: deslocamento de 0 a 15px

Velocidades ligeiramente diferentes por quadro (multiplicador 0.8x a 1.2x baseado no index). Gap de 4px entre quadros. Cantos sem arredondamento.

**Integracao no engine:**

```text
function generateCollageVideo(opts):
  1. Calcular grid layout (posicoes x,y,w,h de cada celula)
  2. Para cada frame:
     - Para cada celula: calcular zoom/pan individual
     - Clipar ao retangulo da celula (ctx.save/clip/restore)
     - Desenhar foto com transformacao
  3. Texto: overlay central com fundo semi-transparente (a partir de 40% do tempo)
  4. Fade out final 0.8s
```

**Arquivo: `MemoryVideoPreview.tsx`**
- Passar highlightId para que o engine possa posicionar a foto destaque na celula maior (quando grid assimetrico)

---

## 4. Fluxo atualizado do usuario

```text
Passo 1: Selecionar fotos (1 a 10)
  - Tap para selecionar
  - Segundo tap em foto selecionada = marcar como destaque (estrela)
  - Tap no destaque = remover destaque (volta a check normal)

Passo 2: Escrever frase (opcional, sem alteracoes)

Passo 3: Escolher formato
  - Toggle: [Imagem] [Video]
  - Texto informativo automatico:
    - Imagem + 1-5 fotos: "Sera gerada 1 imagem"
    - Imagem + 6-10 fotos: "Serao geradas 2 imagens"
    - Video + 1-5 fotos: "Video slideshow cinematografico"
    - Video + 6-10 fotos: "Video colagem animada"

Passo 4: Preview
  - Imagem: canvas(es) com scroll se 2 imagens
  - Video: player com autoplay loop
```

---

## 5. Arquivos a criar/modificar

| Arquivo | Acao |
|---|---|
| `src/components/deliver/memory/MemoryPhotoSelector.tsx` | Modificar -- maxSelection=10, logica de destaque (segundo tap) |
| `src/components/deliver/memory/MemoryCreator.tsx` | Modificar -- maxSelection=10, estado highlightId, passar para filhos |
| `src/components/deliver/memory/MemoryLayoutPicker.tsx` | Modificar -- remover botoes de layout, manter toggle formato, texto informativo |
| `src/components/deliver/memory/MemoryCanvas.tsx` | Modificar -- layouts automaticos por quantidade, divisao em 2 imagens para 6+, foto destaque maior |
| `src/components/deliver/memory/MemoryVideoEngine.ts` | Modificar -- adicionar modo colagem animada para 6+ fotos com movimentos independentes por quadro |
| `src/components/deliver/memory/MemoryVideoPreview.tsx` | Modificar -- passar highlightId ao engine |

Nenhum arquivo novo sera criado.

---

## 6. Detalhes tecnicos do video colagem

### Calculo de celulas do grid

```text
function calculateGrid(photoCount):
  configs predefinidos por quantidade (6-10)
  cada celula = { x, y, w, h, isLarge }
  celulas "large" reservadas para foto destaque
  gap fixo de 4px entre celulas
```

### Render loop da colagem

```text
Para cada frame:
  elapsed = tempo decorrido
  
  Para cada celula (i):
    // Movimento independente
    seed = i * 137  // pseudo-aleatorio deterministico
    moveType = seed % 3  // zoom, panX, panY
    speed = 0.8 + (seed % 5) * 0.1  // velocidade variada
    progress = elapsed * speed / totalDuration
    
    ctx.save()
    ctx.beginPath()
    ctx.rect(celula.x, celula.y, celula.w, celula.h)
    ctx.clip()
    
    // Aplicar transformacao baseada no moveType
    drawImageCover(ctx, img, x_ajustado, y_ajustado, w, h, zoom)
    
    ctx.restore()
  
  // Texto centralizado com overlay
  if elapsed > totalDuration * 0.4:
    drawCenteredTextWithOverlay(...)
  
  // Fade out
  if elapsed > totalDuration - 0.8:
    drawFadeOut(...)
```

### Export de multiplas imagens (canvas)

```text
Para 6-10 fotos no modo imagem:
  bloco1 = fotos[0..metade]
  bloco2 = fotos[metade..fim]
  
  canvas1 = renderizar layout do bloco1
  canvas2 = renderizar layout do bloco2
  
  Preview: mostrar ambos empilhados com scroll
  Download: salvar ambos como lembranca-1.png e lembranca-2.png
  Share: compartilhar ambos via Web Share API (files array)
```

