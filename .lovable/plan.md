

## Glassmorphism Dashboard Upgrade

### Changes to `src/pages/Home.tsx`

**1. Background** — Replace flat `bg-[hsl(220,15%,97%)]` with a warm radial gradient background using inline style:
```
background: linear-gradient(135deg, #fdf6f0 0%, #f3ece4 30%, #eef1f5 70%, #f6f7f9 100%)
```
Plus a subtle radial glow from top-left using `radial-gradient(ellipse at 10% 10%, rgba(242,140,82,0.08) 0%, transparent 60%)`.

**2. Card class** — Replace current `cardClass`:
```
From: 'bg-white rounded-2xl shadow-sm border border-border/30 p-6'
To: inline style with:
  - background: rgba(255,255,255,0.65)
  - backdropFilter: blur(12px)
  - border: 1px solid rgba(255,255,255,0.35)
  - boxShadow: 0 8px 30px rgba(0,0,0,0.05)
  - borderRadius: 16px
  - padding: 24px
```
Keep Tailwind class `rounded-2xl p-6` and add the glass styles via a shared style object to avoid repetition.

**3. Chart colors** — Update `STATUS_MAP` colors:
- `rascunho` (Criadas): `#C9CED6` (neutral gray)
- `enviado` (Enviadas): `#4A90E2` (soft blue)
- `selecao_iniciada` (Em seleção): `#F28C52` (Lunari orange)
- `selecao_completa` (Concluídas): `#4CAF7A` (soft green)
- `expirado` (Expiradas): `#F26B6B` (soft red)

**4. No other logic changes** — All data hooks, queries, metrics computations, and table remain identical. Only visual styling is updated.

### File
- `src/pages/Home.tsx` only

