

## Ajustar movimento vertical alternado + ruído sobre os radiais

### Mudanças em `src/components/InternalBackground.tsx`

1. **Movimento alternado**: A esfera esquerda sobe enquanto a direita desce e vice-versa. A esfera esquerda já usa `eclipse-float-delayed` (com delay -15s), mas o movimento precisa ser mais amplo e claramente alternado. Inverter a direção de uma delas usando um keyframe separado (`eclipse-float-reverse`: `translateY(0) → translateY(30px)` em vez de `-30px`).

2. **Ruído SVG por cima**: Mover o bloco de ruído SVG para **depois** das esferas (já está, mas garantir `z-index` acima) e aumentar levemente a opacidade de `0.02` para `0.03` para ficar mais perceptível.

### Mudanças em `src/index.css`

Adicionar keyframe reverso:
```css
@keyframes eclipse-float-reverse {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(30px); }
}
```

### Arquivos
- `src/components/InternalBackground.tsx` — esfera direita usa `eclipse-float`, esfera esquerda usa `eclipse-float-reverse`; ruído com opacidade `0.03`
- `src/index.css` — adicionar `eclipse-float-reverse` keyframe e classe

