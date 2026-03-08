

## Usar imagem de ondas como fundo das páginas internas

### O que muda

Substituir os blobs animados do `InternalBackground` pela imagem de ondas amber/copper enviada, mantendo-a como fundo fixo em todas as páginas internas (exceto dashboard).

### Mudanças

**1. Copiar imagem para `src/assets/internal-bg.png`**

**2. Reescrever `src/components/InternalBackground.tsx`**

- Importar a imagem como módulo ES6
- Renderizar como `<img>` fullscreen fixa com `object-cover`
- Light mode: opacidade ~0.35 (sutil mas visível)
- Dark mode: opacidade ~0.08, com `mix-blend-mode: screen` para integrar com fundo escuro
- Manter o noise SVG overlay existente
- Remover os blobs animados

### Arquivos
- `src/assets/internal-bg.png` (novo)
- `src/components/InternalBackground.tsx` (reescrito)

