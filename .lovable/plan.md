
# Lembranca Compartilhavel - Gallery Transfer

## Resumo

Criar um modulo de encerramento emocional dentro da galeria de entrega (Transfer) que permite ao cliente selecionar fotos favoritas, adicionar uma frase pessoal, e gerar um conteudo visual 9:16 (stories) pronto para compartilhar -- sem nenhum branding do fotografo.

## Fluxo do usuario

```text
Cliente abre galeria Transfer
  --> Visualiza e baixa fotos normalmente
  --> Apos scroll, aparece uma secao sutil ao final da galeria:
      "Crie sua lembranca"
  --> Clica e entra no fluxo (fullscreen overlay, mobile-first)

Passo 1: Selecionar fotos (1 a 4)
  --> Grid compacto das fotos da galeria
  --> Tap para selecionar/deselecionar
  --> Contador visual discreto

Passo 2: Escrever uma frase (opcional)
  --> Input minimalista com placeholder emocional
  --> Ex: "Um momento que vou guardar para sempre"
  --> Limite de ~80 caracteres

Passo 3: Escolher layout
  --> 2-3 templates de colagem (previews visuais)
  --> Layout A: foto unica centralizada com frase sobreposta
  --> Layout B: 2 fotos lado a lado (ou empilhadas) com frase
  --> Layout C: colagem de 3-4 fotos em grid assimetrico com frase

Passo 4: Preview e salvar
  --> Preview 9:16 renderizado com Canvas API
  --> Botao "Salvar imagem" (download como PNG)
  --> Botao "Compartilhar" (Web Share API, fallback para download)
  --> Sem botao de video na V1 (complexidade alta, futuro)
```

## Arquitetura de componentes

| Componente | Responsabilidade |
|---|---|
| `DeliverMemorySection` | Secao CTA ao final do grid ("Crie sua lembranca") |
| `MemoryCreator` | Overlay fullscreen com o fluxo de 4 passos |
| `MemoryPhotoSelector` | Grid de selecao de fotos (tap to select) |
| `MemoryTextInput` | Campo de frase pessoal com placeholder emocional |
| `MemoryLayoutPicker` | Previews dos templates de colagem |
| `MemoryCanvas` | Renderizacao do canvas 9:16 e export para imagem |

Todos dentro de `src/components/deliver/memory/`.

## Detalhes tecnicos

### Canvas 9:16

- Dimensao: 1080x1920 pixels (padrao stories)
- Fundo: cor solida escura (#1C1917) ou clara (#FAF9F7) baseado no tema da galeria
- Fotos: carregadas via `Image()` a partir das URLs R2 (preview paths, alta resolucao)
- Texto: renderizado com `ctx.fillText()` usando a fonte da sessao (sessionFont)
- Export: `canvas.toBlob('image/png')` para download ou share

### Layouts (3 opcoes)

**Layout A - "Solo"**: 1 foto centralizada ocupando ~70% da altura, frase na parte inferior com tipografia grande
**Layout B - "Dupla"**: 2 fotos empilhadas verticalmente (50/50), frase entre elas ou abaixo
**Layout C - "Colagem"**: Grid assimetrico 2x2 com uma foto maior, frase sobreposta em fundo semitransparente

### Web Share API

```text
navigator.share({
  files: [new File([blob], 'lembranca.png', { type: 'image/png' })],
  title: sessionName
})
```
Fallback: download direto se share nao suportado.

### Integracao com ClientDeliverGallery

- `DeliverMemorySection` renderizado apos `DeliverPhotoGrid`
- Recebe `photos`, `sessionName`, `sessionFont`, `isDark`, `bgColor`
- Estado `showMemoryCreator` controlado no `ClientDeliverGallery`
- Nao interfere com download (secao separada, apos todas as fotos)

### CORS e Imagens no Canvas

Para renderizar imagens no canvas sem erro de "tainted canvas":
- Usar `img.crossOrigin = 'anonymous'` ao carregar imagens
- O CDN R2 (`media.lunarihub.com`) ja serve com CORS habilitado

### Sem dependencias externas

- Canvas API nativa do browser (sem bibliotecas)
- Web Share API nativa
- Fontes ja carregadas pela galeria (Google Fonts no index.html)

## Arquivos a criar/modificar

| Arquivo | Acao |
|---|---|
| `src/components/deliver/memory/DeliverMemorySection.tsx` | Criar -- secao CTA ao final do grid |
| `src/components/deliver/memory/MemoryCreator.tsx` | Criar -- overlay fullscreen com fluxo de 4 passos |
| `src/components/deliver/memory/MemoryPhotoSelector.tsx` | Criar -- grid de selecao de fotos |
| `src/components/deliver/memory/MemoryTextInput.tsx` | Criar -- input de frase pessoal |
| `src/components/deliver/memory/MemoryLayoutPicker.tsx` | Criar -- seletor de layout com previews |
| `src/components/deliver/memory/MemoryCanvas.tsx` | Criar -- renderizacao canvas + export |
| `src/pages/ClientDeliverGallery.tsx` | Modificar -- adicionar secao e estado do overlay |

## Estetica e tom

- Cores: herda do tema da galeria (dark/light)
- Tipografia: fonte da sessao para titulos, system font para UI
- Animacoes: transicoes suaves entre passos (`transition-all duration-500`)
- Icones: Lucide (Heart, Sparkles, Share2, Download, ArrowLeft)
- Espacamento: generoso, respirado, sem densidade
- Bordas: `rounded-none` para fotos (coerente com o grid da galeria)
- CTA: texto delicado, nao imperativo ("Se quiser, crie uma lembranca desse momento")

## O que NAO sera incluido

- Video (V1 apenas imagem estatica)
- Logo/nome do fotografo
- @Instagram ou qualquer rede social
- Marca d'agua
- Musica
- Tracking/analytics
- Obrigatoriedade (secao opcional ao final)
