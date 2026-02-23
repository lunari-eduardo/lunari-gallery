

# Correcao do Modulo Lembranca Compartilhavel

## Problemas identificados

### 1. Loop infinito de renderizacao (flickering)
A variavel `selectedPhotos` e recalculada a cada render (linha 66-68 do MemoryCanvas), criando uma nova referencia de array. Como ela e dependencia do `useCallback`, o `render` e recriado a cada ciclo, disparando o `useEffect` infinitamente.

### 2. Erro CORS nas imagens
O `crossOrigin = 'anonymous'` exige que o servidor retorne `Access-Control-Allow-Origin`. O CDN `media.lunarihub.com` nao retorna esse header para o origin `gallery.lunarihub.com`. Todas as imagens falham, mas o loop continua tentando.

### 3. Textos imperceptiveis
Combinacao de cores ja claras (`#A8A29E`, `#78716C`) com opacidades baixas (`opacity-30`, `opacity-40`, `opacity-50`) torna o texto praticamente invisivel. Fontes `text-xs` e `text-sm` agravam o problema.

## Solucao

### Arquivo: `src/components/deliver/memory/MemoryCanvas.tsx`

**A) Eliminar loop infinito**: Estabilizar dependencias do `useCallback` usando `selectedIds` (array de strings, estavel) em vez de `selectedPhotos` (array de objetos, recriada a cada render). Mover a logica de busca de fotos para dentro do callback.

**B) Resolver CORS**: Remover `crossOrigin = 'anonymous'` do `loadImage`. Em vez disso, carregar as imagens normalmente (sem CORS) para exibicao no canvas. O canvas ficara "tainted" (nao exportavel via toBlob). Para contornar isso, usar uma abordagem de proxy: carregar a imagem via `fetch()` com mode `no-cors` nao funciona. A solucao correta e:
- Remover `img.crossOrigin = 'anonymous'`
- As imagens carregarao normalmente (sem CORS blocking)
- Para o export (toBlob), usar `fetch` para baixar como blob, criar objectURL, e carregar no canvas com `crossOrigin` a partir do objectURL (mesmo origin = sem CORS)

Na pratica, a solucao mais simples: **carregar via fetch -> blob -> objectURL -> Image**. Isso evita CORS porque o objectURL e local.

**C) Renderizar apenas uma vez**: Adicionar flag `hasRendered` via useRef para evitar re-renderizacoes desnecessarias. O render so dispara quando o step muda para 'preview'.

### Arquivo: `src/components/deliver/memory/DeliverMemorySection.tsx`

**Aumentar visibilidade dos textos:**
- "Lembranca": de `text-sm opacity-40` para `text-sm opacity-70`
- Titulo: manter `text-xl sm:text-2xl` (ja adequado)
- Descricao: de `text-sm opacity-50` para `text-base opacity-70`
- Icone Sparkles: de `opacity-30` para `opacity-50`

### Arquivo: `src/components/deliver/memory/MemoryCreator.tsx`

**Aumentar visibilidade:**
- Progress dots: de `opacity: 0.8/0.3` para `opacity: 1/0.4`
- Step title: de `text-lg` para `text-xl`

### Arquivo: `src/components/deliver/memory/MemoryPhotoSelector.tsx`

**Aumentar visibilidade:**
- Contador: de `text-sm opacity-60` para `text-sm opacity-80`

### Arquivo: `src/components/deliver/memory/MemoryTextInput.tsx`

**Aumentar visibilidade:**
- Instrucao: de `text-sm opacity-60` para `text-sm opacity-80`
- Textarea placeholder: de `placeholder:opacity-30` para `placeholder:opacity-50`
- Contador caracteres: de `text-xs opacity-40` para `text-xs opacity-60`

### Arquivo: `src/components/deliver/memory/MemoryLayoutPicker.tsx`

**Aumentar visibilidade:**
- Instrucao: de `text-sm opacity-60` para `text-sm opacity-80`

### Arquivo: `src/components/deliver/memory/MemoryCanvas.tsx` (UI)

**Aumentar visibilidade:**
- "Gerando...": de `text-sm opacity-40` para `text-sm opacity-70`

## Resumo tecnico da correcao do loop

```text
ANTES (quebrado):
  selectedPhotos = recalculado cada render (nova ref)
    -> useCallback depende de selectedPhotos
      -> render() recriado
        -> useEffect dispara render()
          -> setRendering(true) / setRendered(true)
            -> re-render -> selectedPhotos recalculado -> loop infinito

DEPOIS (corrigido):
  useCallback depende de [selectedIds.join(','), text, layout, ...]
    -> string estavel, nao muda entre renders
    -> render() chamado apenas 1x quando step muda para preview
    -> Imagens carregadas via fetch->blob->objectURL (sem CORS)
```

## Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `src/components/deliver/memory/MemoryCanvas.tsx` | Corrigir loop infinito (estabilizar deps), resolver CORS (fetch->blob->objectURL), aumentar opacidade do "Gerando..." |
| `src/components/deliver/memory/DeliverMemorySection.tsx` | Aumentar opacidades e tamanhos de fonte |
| `src/components/deliver/memory/MemoryCreator.tsx` | Aumentar opacidades dos dots e tamanho do titulo |
| `src/components/deliver/memory/MemoryPhotoSelector.tsx` | Aumentar opacidade do contador |
| `src/components/deliver/memory/MemoryTextInput.tsx` | Aumentar opacidades da instrucao, placeholder e contador |
| `src/components/deliver/memory/MemoryLayoutPicker.tsx` | Aumentar opacidade da instrucao |
