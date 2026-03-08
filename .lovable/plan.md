

## Dashboard Glassmorphism Refactor

This plan covers updating the CSS design tokens and the `.glass` utility class in `src/index.css`, then refactoring `src/pages/Home.tsx` to use the new glass system. The scope is limited to the **dashboard page and global CSS tokens only** — Layout, other pages, and edge functions remain untouched.

### Phase 1: Update CSS Tokens (`src/index.css`)

**Light mode `:root`** — Replace current tokens with the new terra-cota palette:
- `--background: 30 40% 96%`, `--foreground: 20 20% 12%`
- `--card: 30 30% 98%`, `--primary: 19 49% 45%`, `--primary-foreground: 30 30% 98%`
- `--secondary: 30 20% 92%`, `--muted: 30 15% 90%`, `--border: 30 30% 80%`
- Add full `--terra-50` through `--terra-900` scale
- Add glass tokens: `--glass-bg`, `--glass-border`, `--glass-shadow`, `--glass-hover-shadow`

**Dark mode `.dark`** — Update with specified dark values:
- `--background: 20 15% 6%`, `--foreground: 30 15% 95%`
- `--card: 20 12% 10%`, `--border: 20 15% 20%`
- Dark glass tokens with reduced opacities

**New `.glass` utility class** in `@layer components`:
```css
.glass {
  @apply backdrop-blur-xl rounded-2xl border transition-all duration-300;
  background: hsl(var(--glass-bg));
  border-color: hsl(var(--glass-border));
  box-shadow: var(--glass-shadow);
}
.glass:hover {
  box-shadow: var(--glass-hover-shadow);
}
```

**Custom scrollbar** styles added globally.

### Phase 2: Refactor Dashboard (`src/pages/Home.tsx`)

- Remove inline `glassStyle` object — replace all `style={glassStyle}` with `className="glass p-6"`
- Replace inline background gradient with a dedicated background component using:
  - Base gradient: `linear-gradient(135deg, #fdf0e6 0%, #f5dcc4 50%, #fdf0e6 100%)`
  - 2-3 animated radial blobs (terra-cota tones, low opacity, CSS `@keyframes float`)
  - SVG noise overlay at `opacity: 0.02`
- Update icon containers to use `rounded-xl bg-primary/10` style
- Add hover `-translate-y-1` on metric cards
- Keep all data logic, hooks, queries, and table structure identical

### Files Modified
1. `src/index.css` — tokens, glass class, scrollbar, noise/float keyframes
2. `src/pages/Home.tsx` — visual refactor only, no logic changes

### What stays unchanged
- `src/components/Layout.tsx` — no changes (header/nav glass treatment deferred to later)
- All edge functions (infinitepay, webhooks) — untouched
- All other pages — untouched
- All data hooks and Supabase queries — untouched

