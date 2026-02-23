

# Video de Lembranca - Motor de Video 9:16 Client-Side

## Resumo

Adicionar a opcao de gerar um video curto (max 10s) no formato 9:16 (stories) ao modulo de Lembranca existente. O video sera gerado 100% no browser usando Canvas API + `captureStream()` + `MediaRecorder`, sem dependencias externas ou servidor.

## Roteiros inteligentes por quantidade de fotos

| Fotos | Duracao total | Tempo/foto | Comportamento |
|-------|-------------|------------|---------------|
| 1     | 6s          | 6s         | Zoom lento continuo (Ken Burns). Frase centralizada com fade-in aos 2s |
| 2     | 8s          | 4s cada    | Crossfade entre fotos. Frase aparece com fade na 2a foto |
| 3     | 9s          | 3s cada    | Foto 1: introducao pura. Foto 2: frase aparece com fade. Foto 3: encerramento sem texto |
| 4-5   | 10s         | 2.5-2s     | Sequencia ritmica. Frase aparece na 3a foto. Crossfade suave entre todas |
| 6-7   | 10s         | ~1.5s      | Ritmo dinamico. Frase no meio (foto 3 ou 4). Encerramento so imagem |

## Efeitos visuais

- **Ken Burns**: zoom lento de 1.0x a 1.08x em cada foto (sensacao cinematica)
- **Crossfade**: transicao suave entre fotos (0.5s de blend)
- **Fade-in do texto**: opacidade de 0 a 1 em 0.6s quando a frase aparece
- **Fade to black/white**: ultimo 0.8s do video faz fade para a cor de fundo

## Arquitetura tecnica

### Motor de video: `MemoryVideoEngine.ts` (novo)

Arquivo utilitario puro (sem React) que:
1. Recebe: lista de `HTMLImageElement`, texto, isDark, font, duracao
2. Cria um `OffscreenCanvas` (ou canvas oculto) 1080x1920
3. Usa `canvas.captureStream(30)` para capturar a 30fps
4. Cria `MediaRecorder` com `video/webm; codecs=vp9` (fallback para `vp8`)
5. Executa loop de animacao com `requestAnimationFrame`
6. Desenha cada frame: foto atual com zoom + crossfade + texto
7. Para o recorder apos a duracao total
8. Retorna um `Blob` do video

```text
Timeline de um video de 3 fotos (9s):
|--- Foto 1 (3s) ---|--- Foto 2 (3s) ---|--- Foto 3 (3s) ---|
     zoom 1.0->1.08      zoom + texto         zoom + fade out
                    |fade|            |fade|
                    0.5s              0.5s
```

### Componente: `MemoryVideoPreview.tsx` (novo)

- Recebe as mesmas props que `MemoryCanvas`
- Usa `MemoryVideoEngine` para gerar o video
- Mostra um `<video>` com autoplay + loop + muted para preview
- Botoes: "Salvar video" (download .webm) e "Compartilhar" (Web Share API)
- Estado: `generating` (com progresso), `ready`, `error`

### Integracao no fluxo existente

**Arquivo: `MemoryLayoutPicker.tsx`**
- Adicionar toggle "Imagem / Video" acima dos layouts
- Tipo exportado: `MemoryOutputType = 'image' | 'video'`
- Quando "Video" selecionado, os layouts de colagem nao se aplicam (video e sempre fullscreen por foto)

**Arquivo: `MemoryCreator.tsx`**
- Novo estado: `outputType: 'image' | 'video'`
- No step `preview`: renderizar `MemoryCanvas` se imagem, `MemoryVideoPreview` se video
- Aumentar `maxSelection` para 7 quando video selecionado

**Arquivo: `MemoryPhotoSelector.tsx`**
- Aceitar `maxSelection` dinamico (4 para imagem, 7 para video)

## Detalhes do motor de animacao

### Calculo de timeline

```text
function buildTimeline(photoCount, totalDuration):
  timePerPhoto = totalDuration / photoCount
  crossfadeDuration = 0.5s (fixo)
  
  Para cada foto:
    startTime = i * timePerPhoto
    endTime = startTime + timePerPhoto
    showText = (regra por quantidade, conforme tabela)
    
  fadeOutStart = totalDuration - 0.8s
```

### Render loop (simplificado)

```text
Em cada frame (requestAnimationFrame):
  currentTime = (performance.now() - startTime) / 1000
  
  1. Determinar foto atual e proxima (baseado em currentTime)
  2. Calcular progresso do crossfade (0 a 1)
  3. Calcular zoom (1.0 + 0.08 * progressoDaFoto)
  4. Desenhar foto atual com zoom (drawImageCover com escala)
  5. Se em crossfade: desenhar proxima foto com globalAlpha
  6. Se momento do texto: desenhar com fade-in
  7. Se no fade final: overlay com globalAlpha crescente
  
  Se currentTime >= totalDuration: parar recorder
```

### Formato de saida

- `video/webm; codecs=vp9` (suporte Chrome, Edge, Firefox)
- Fallback: `video/webm; codecs=vp8`
- Fallback final (Safari): `video/mp4` via `MediaRecorder` se disponivel, senao exportar como GIF ou manter apenas imagem
- Safari nao suporta `MediaRecorder` em todas as versoes -- detectar e desabilitar opcao de video quando indisponivel

### Compatibilidade

```text
if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported('video/webm')) {
  // Esconder opcao de video, mostrar apenas imagem
}
```

## Arquivos a criar/modificar

| Arquivo | Acao |
|---|---|
| `src/components/deliver/memory/MemoryVideoEngine.ts` | Criar -- motor de animacao e gravacao de video |
| `src/components/deliver/memory/MemoryVideoPreview.tsx` | Criar -- componente de preview e export do video |
| `src/components/deliver/memory/MemoryLayoutPicker.tsx` | Modificar -- adicionar toggle Imagem/Video |
| `src/components/deliver/memory/MemoryCreator.tsx` | Modificar -- estado outputType, renderizar video ou imagem |
| `src/components/deliver/memory/MemoryPhotoSelector.tsx` | Modificar -- maxSelection dinamico |

## Fluxo atualizado do usuario

```text
Passo 1: Selecionar fotos (1 a 7)
Passo 2: Escrever frase (opcional)
Passo 3: Escolher formato
  --> Toggle: [Imagem] [Video]
  --> Se imagem: escolher layout (solo/dupla/colagem)
  --> Se video: sem escolha de layout (fullscreen automatico)
Passo 4: Preview
  --> Imagem: canvas estatico (existente)
  --> Video: geracao + preview com <video> autoplay loop
  --> Botoes: Salvar / Compartilhar
```

## Limitacoes conhecidas (V1)

- Safari (iOS/macOS): `MediaRecorder` com WebM tem suporte limitado. Em dispositivos sem suporte, a opcao "Video" ficara oculta e apenas "Imagem" estara disponivel
- Formato WebM (nao MP4): alguns apps de edicao podem nao reconhecer. Porem, WhatsApp e Instagram aceitam WebM para stories
- Sem audio/musica (conforme requisito)
- Maximo 7 fotos / 10 segundos

