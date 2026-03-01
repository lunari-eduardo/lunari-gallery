

## Corrigir botão "Voltar" do mobile no Lightbox

### Problema
Quando o lightbox está aberto, o botão de voltar do dispositivo móvel aciona `history.back()`, que navega para fora do site em vez de simplesmente fechar o lightbox.

### Solução
Usar a History API: ao abrir o lightbox, fazer `history.pushState` para criar uma entrada no histórico. Escutar o evento `popstate` para interceptar o botão voltar e chamar `onClose()` em vez de sair da página.

### Arquivos impactados

**1. `src/components/Lightbox.tsx`**
- Adicionar `useEffect` que faz `window.history.pushState({ lightbox: true }, '')` no mount
- Escutar `popstate` — quando disparado, chamar `onClose()`
- No cleanup, se o state ainda tiver `lightbox`, fazer `history.back()` para limpar a entrada extra
- No `onClose` manual (botão X, Escape), fazer `history.back()` para remover a entrada do histórico

**2. `src/components/deliver/DeliverLightbox.tsx`**
- Mesma lógica de `pushState` + `popstate` listener

