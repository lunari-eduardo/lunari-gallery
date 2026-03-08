

## Problema: Efeito Glass Invisível no Modo Claro

### Causa
No modo claro, o `--background` é `30 40% 96%` (quase branco) e o `--glass-bg` é `0 0% 100% / 0.25` (branco a 25% de opacidade). Branco sobre fundo quase branco = aparência sólida. O header usa `bg-background/95` — praticamente opaco.

### Solução

**1. `src/index.css` — tokens light mode:**
- `--glass-bg`: de `0 0% 100% / 0.25` → `0 0% 100% / 0.45` (mais translúcido mas ainda legível)
- `--glass-border`: de `0 0% 100% / 0.18` → `0 0% 100% / 0.35`
- `--background`: de `30 40% 96%` → `30 40% 96%` (manter, mas reduzir opacidade onde usado)

**2. `src/components/Layout.tsx` — header:**
- Trocar `bg-background/95 ... bg-background/60` por classes glass: `bg-white/40 backdrop-blur-xl` (light) que permitem ver os blobs atrás

**3. `src/index.css` — classe `.glass` light mode:**
- Aumentar opacidade do glass-bg para compensar legibilidade mantendo transparência visual
- Alternativa melhor: usar `--glass-bg: 30 30% 98% / 0.55` — tom levemente cream em vez de branco puro, dando identidade sem parecer sólido

### Mudanças concretas

**`src/index.css`** (`:root` / light):
```css
--glass-bg: 30 30% 98% / 0.55;
--glass-border: 30 30% 85% / 0.40;
```

**`src/components/Layout.tsx`** (header):
```tsx
// de:
bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60
// para:
backdrop-blur-xl bg-white/40 dark:bg-background/60 border-b border-border/30
```

Isso mantém legibilidade dos cards mas permite que os blobs terra-cota brilhem por trás, criando o efeito vidro real.

