

## Problema: `.glass` não funciona no dark mode nos Cards

### Causa raiz

O componente `Card` aplica `bg-card` (utility do Tailwind, `@layer utilities`). A classe `.glass` define `background: hsl(var(--glass-bg))` dentro de `@layer components`. No Tailwind, **utilities sempre vencem components em especificidade**. Então `bg-card` sobrescreve o background translúcido do `.glass`, resultando em cards opacos — especialmente visível no dark mode onde `--card` é `20 12% 10%` (sólido escuro).

### Solução

Duas alterações cirúrgicas:

1. **`src/index.css`** — Adicionar `!important` ao background da classe `.glass` para garantir que sempre vença utilities do Tailwind:
```css
.glass {
  background: hsl(var(--glass-bg)) !important;
}
```

2. **Aumentar levemente a opacidade do `--glass-bg` no dark mode** (`src/index.css`, bloco `.dark`) de `0.015` para `0.06`, para que os cards tenham uma sutil translucidez visível sobre o fundo escuro em vez de parecerem invisíveis.

### Arquivos
- `src/index.css` — 2 pontos: `!important` no `.glass` + ajuste de `--glass-bg` dark

