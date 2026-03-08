

## Aurora gradient mais forte no modo claro

### Mudança em `src/pages/Home.tsx` (linhas 194-207)

Aumentar opacidades dos gradientes no modo light e reduzir o blur para ficar menos difuso. Usar a cor terra-cota do sistema (`#ac5e3a` / `rgb(172,94,58)`) nos gradientes:

**Light mode (atual → novo):**
- `rgba(242,170,100,0.15)` → `rgba(172,94,58,0.25)`
- `rgba(255,200,140,0.12)` → `rgba(194,149,106,0.20)`
- `rgba(230,180,130,0.08)` → `rgba(172,94,58,0.15)`
- `blur(60px)` → `blur(40px)` (menos difuso)

**Dark mode:** sem alteração.

### Arquivo
- `src/pages/Home.tsx` — apenas ajustar valores do aurora gradient light

