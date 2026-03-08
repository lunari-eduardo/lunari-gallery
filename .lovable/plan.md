

## Substituir fundo de imagem por eclipse âmbar animado em todo o sistema

### Contexto
A imagem de referência mostra um efeito de "eclipse" — uma esfera âmbar concentrada com borda brilhante e centro escuro, sobre fundo claro difuso. Vamos recriar esse efeito com CSS puro (radial-gradient) e animação lenta.

### Mudanças

**1. `src/components/InternalBackground.tsx` — Reescrever completamente**

Remover a imagem PNG e substituir por um efeito eclipse CSS:

- Um `radial-gradient` grande e concentrado posicionado no centro-esquerdo (~35% 45%) que simula a esfera do eclipse:
  - Centro escuro (`rgba(80,40,20,0.6)`)
  - Borda brilhante âmbar (`rgba(194,120,60,0.4)` a ~40%)
  - Fade para transparente (~60%)
- Um segundo radial menor como "glow" ao redor da borda
- `filter: blur(20px)` para suavizar mas manter concentrado
- Animação lenta CSS de ~30s que move o eclipse suavemente (translate + rotate leve) — reutilizar/adaptar o keyframe `aurora` existente ou criar um `eclipse-drift`
- Light: opacidade ~0.8-1.0 nos gradientes para ficar evidente
- Dark: opacidade reduzida ~0.15-0.2

**2. `src/index.css` — Adicionar keyframe `eclipse-drift`**

```css
@keyframes eclipse-drift {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(3%, -2%) scale(1.02); }
  66% { transform: translate(-2%, 3%) scale(0.98); }
}
```

Animação de 30s, ease, infinite — movimento muito sutil para parecer orgânico.

**3. `src/components/Layout.tsx`**

- Manter o `<InternalBackground />` sendo renderizado em todas as páginas exceto `/dashboard` (sem mudança de lógica, apenas o componente interno muda)

### Detalhes técnicos

O efeito eclipse será construído com camadas de `radial-gradient`:
- Camada 1: Centro escuro-quente → borda âmbar brilhante → transparente (simula a esfera)
- Camada 2: Glow difuso âmbar ao redor (blur maior)
- Camada 3: Ruído SVG mantido (2% opacidade)

Posição levemente off-center (como na referência) para parecer natural. O `blur` baixo (15-20px) mantém o efeito concentrado, não difuso como um degradê genérico.

### Arquivos
- `src/components/InternalBackground.tsx` — reescrever (remover imagem, criar eclipse CSS)
- `src/index.css` — adicionar keyframe `eclipse-drift`

