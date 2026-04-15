

# Fix: Tela pós-confirmação mostrando fotos em vez de mensagem

## Problema identificado

Existem **duas telas distintas** para o estado "confirmado":

1. **In-session (linhas 1418-1520 do `ClientGallery.tsx`)**: Renderizada logo após o cliente confirmar a seleção na mesma sessão. **Sempre mostra grid de fotos com watermark**, independente de `allowDownload`. É o que aparece na imagem-614.

2. **`FinalizedPreviewScreen`**: Renderizada quando o cliente re-acessa a galeria (via `galleryResponse?.finalized`). Já foi corrigida para mostrar mensagem quando `allowDownload=false`.

O problema está na **tela 1**: o bloco de confirmação in-session (linhas 1418-1520) nunca verifica `allowDownload`. Sempre mostra banner + grid de fotos selecionadas com watermark — experiência confusa quando não há download.

## Sobre "Galeria não encontrada"

O token `vd2zupjtbENx` retornou 404 do `gallery-access` (lookup por `public_token` falhou). Isso indica token inválido ou URL incorreta — **não é um bug de lógica** do fluxo de finalização. O fluxo `gallery-access` para galerias finalizadas (`isFinalized = true` na linha 538) funciona corretamente e retorna `finalized: true`.

## Correção

### `src/pages/ClientGallery.tsx` — Bloco de confirmação in-session (linhas 1418-1520)

Quando `isConfirmed && !allowDownload`:
- Remover header com logo e nome da sessão
- Remover grid de fotos selecionadas
- Mostrar tela centralizada com:
  - Logo do estúdio (se disponível)
  - Ícone de check
  - "Seleção Confirmada"
  - Contagem de fotos selecionadas
  - Mensagem: "Sua galeria já foi finalizada. Para acessá-la novamente, entre em contato com o(a) fotógrafo(a)."

Quando `isConfirmed && allowDownload`:
- Manter o comportamento atual (banner + grid + botão download)

A lógica fica:
```tsx
if (isConfirmed && currentStep !== 'confirmation' && currentStep !== 'payment') {
  const allowDownload = gallery.settings.allowDownload;
  
  if (!allowDownload) {
    // Tela simples de mensagem (mesma da FinalizedPreviewScreen sem download)
    return ( /* mensagem centralizada */ );
  }
  
  // Código existente com grid de fotos selecionadas
  return ( /* grid atual */ );
}
```

## Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `src/pages/ClientGallery.tsx` | Bifurcar bloco de confirmação in-session baseado em `allowDownload` |

