

## Corrigir Glassmorphism no Modo Claro

### Problemas Identificados

1. **Layout wrapper tem `bg-background` opaco** — cobre os blobs completamente
2. **Opacidade dos blobs muito baixa** — 0.07-0.09 mal aparece no modo claro
3. **`--card` e `--popover` são cores sólidas** — cards que não usam `.glass` ficam totalmente opacos

### Solução

**1. `src/components/Layout.tsx`** — remover `bg-background` do wrapper principal para que os blobs fiquem visíveis. O body já tem `bg-background` como fallback via CSS.

```tsx
// de:
<div className="min-h-screen bg-background">
// para:
<div className="min-h-screen">
```

**2. `src/components/InternalBackground.tsx`** — aumentar opacidade dos blobs significativamente no modo claro:
- Blob 1: `0.09` → `0.18`
- Blob 2: `0.07` → `0.15`  
- Blob 3: `0.08` → `0.16`

Adicionar classes dark para manter sutil no modo escuro (`dark:opacity-[0.05]`).

**3. `src/index.css`** — tornar `--card` e `--popover` translúcidos no light mode para que cards comuns (não apenas `.glass`) também tenham transparência:

```css
/* Light mode */
--card: 30 30% 98% / 0.6;
--popover: 30 30% 98% / 0.7;
```

E reduzir a opacidade do glass-bg para mais transparência:
```css
--glass-bg: 30 30% 98% / 0.45;  /* era 0.55 */
```

### Arquivos modificados
- `src/components/Layout.tsx` — remover bg-background do wrapper
- `src/components/InternalBackground.tsx` — aumentar opacidade dos blobs
- `src/index.css` — tornar card/popover translúcidos, reduzir glass-bg

