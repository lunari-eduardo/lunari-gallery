

## Ajustar eclipse: duas esferas + centro mais claro + movimento vertical

### Problema
- Apenas uma esfera centralizada
- Centro do radial muito escuro (`rgba(60, 30, 15, 0.55)`)

### Mudanças em `src/components/InternalBackground.tsx`

**Duas esferas com posições distintas:**

1. **Esfera direita (maior):** posição `top: 20%, right: -5%`, tamanho `50vw` (max 800px)
2. **Esfera esquerda (menor):** posição `top: 40%, left: -5%`, tamanho `35vw` (max 550px)

**Centro mais claro** — substituir o centro escuro por tons âmbar médios:
- `rgba(60, 30, 15, 0.55)` → `rgba(172, 94, 58, 0.35)`
- Manter a transição para âmbar claro e transparente

**Movimento vertical (sobe/desce):** Adicionar novo keyframe `eclipse-float` no CSS:
```css
@keyframes eclipse-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-30px); }
}
```
- Esfera direita: 25s
- Esfera esquerda: 35s (delay -15s para dessincronizar)

Cada esfera terá seu glow próprio ao redor.

### Arquivos
- `src/components/InternalBackground.tsx` — reescrever com 2 esferas
- `src/index.css` — adicionar keyframe `eclipse-float`

