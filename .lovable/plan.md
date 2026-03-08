

## Background Animado para Páginas Internas

### O que será feito
Criar um componente `InternalBackground` com 3 blobs radiais terra-cota que se movimentam lentamente (ciclo de 30s) entre posições nos cantos/laterais da tela. Esse componente ficará fixo atrás do conteúdo em todas as páginas exceto `/dashboard` (que já tem o 3D).

### Posições dos blobs (baseado na imagem de referência)

Analisando as marcações vermelhas (posição inicial) e verdes (posição final):

| Blob | Posição A (vermelho) | Posição B (verde) |
|------|---------------------|-------------------|
| 1 | Canto superior direito | Centro direito → centro |
| 2 | Canto inferior esquerdo | Centro esquerdo → centro |
| 3 | Canto inferior direito | Centro inferior |

### Detalhes técnicos

**Novo arquivo: `src/components/InternalBackground.tsx`**
- 3 divs com `position: fixed`, `border-radius: 50%`, gradiente radial terra-cota
- Tamanho: ~35-45vw cada
- Opacidade: 0.06-0.10 (light) / 0.04-0.06 (dark)
- Blur: 80-100px
- Animação CSS `@keyframes` com `animation-duration: 30s`, `infinite`, `alternate`, `ease-in-out`
- `pointer-events: none`, `z-index: 0`
- Overlay de ruído SVG (2% opacity)
- Respeita `prefers-reduced-motion`

**Modificar: `src/components/Layout.tsx`**
- Importar e renderizar `<InternalBackground />` quando a rota **não** for `/dashboard`
- Remover `bg-background` das páginas internas (já condicional para dashboard, expandir para todas)
- O background do body em `index.css` serve como fallback

**Modificar: `src/index.css`**
- Adicionar 3 keyframes para os blobs (`blob-drift-1`, `blob-drift-2`, `blob-drift-3`)

### Keyframes (movimentos lentos e curvos)
```css
@keyframes blob-drift-1 {
  0%   { top: -10%; right: -10%; }
  100% { top: 20%;  right: 30%;  }
}
@keyframes blob-drift-2 {
  0%   { bottom: -5%; left: -10%; }
  100% { bottom: 30%; left: 25%;  }
}
@keyframes blob-drift-3 {
  0%   { bottom: -10%; right: -5%; }
  100% { bottom: 25%;  right: 35%; }
}
```
Todos com `animation: blob-drift-N 30s ease-in-out infinite alternate`.

