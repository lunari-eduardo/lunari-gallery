## Objetivo

Fazer o fundo bege/orbital do Dashboard e as esferas do `InternalBackground` reagirem ao preset de tema (Lunari, Sage, Ocean, Lavender, Rose, Coral, Mono), igual ao Lunari Studio. Hoje ambos usam cores terracota fixas (`#F28C52`, `rgba(172,94,58,...)` etc.) e ignoram `--brand-h/s/l`.

## O que falta

1. **`src/pages/Home.tsx` → `DashboardBackground`**
   - Gradient base no light está chumbado em `#FFFFFF`/`#0D0A08` (ok), mas o aurora gradient e a cor `COPPER` (`#F28C52`) das ring/spheres 3D são fixos terracota.
2. **`src/components/InternalBackground.tsx`**
   - Todas as esferas usam `rgba(172, 94, 58, …)` / `rgba(194, 140, 80, …)` chumbados. Não trocam com preset.
3. **Mono (preto & branco)** precisa de fallback neutro (cinza) — não pode aparecer cor saturada.

## Como implementar (técnico)

### 1. Helper de cor de marca (novo: `src/lib/brandColor.ts`)
Hook leve `useBrandColor()` que lê `--brand-h`, `--brand-s`, `--brand-l` do `:root` (via `getComputedStyle`) e reage a mudanças. Retorna:
```ts
{ h, s, l, hex, rgb: {r,g,b}, isMono }
```
- Implementação: assina o `MutationObserver` em `documentElement` filtrado por `style` + `class` (já que `applyTheme` muda `style`). Converte HSL→RGB para uso em three.js e rgba().
- `isMono` = `s === 0`.

### 2. `InternalBackground.tsx`
- Substituir todas as `rgba(172,94,58,a)` / `rgba(194,…)` por `hsl(var(--brand-h) var(--brand-s) var(--brand-l) / a)` direto no `style.background` (CSS puro, sem JS — performático).
- Para o "glow" externo, usar `hsl(var(--brand-h) var(--brand-s) var(--brand-glow-l) / a)`.
- Mono: como `--brand-s` é `0%`, naturalmente vira escala de cinza. Nenhum tratamento extra necessário.
- Manter o `opacity-60 dark:opacity-25` e os blurs.

### 3. `Home.tsx` → `DashboardBackground`
- Remover constante `COPPER`. Trocar por `useBrandColor()` e passar `color={brand.hex}` para `<meshBasicMaterial>` em `TorusRing` e `OrbitingSphere`.
- Aurora gradient: trocar `rgba(172,94,58,…)` / `rgba(194,149,106,…)` por `hsl(${h} ${s}% ${l}% / a)` interpolado a partir do hook. Manter as 3 camadas e o blur.
- Base gradient light: trocar `#FFFFFF` por `hsl(var(--surface-hue) calc(var(--surface-sat) * 4) 98%)` para casar com `--background`. Dark mantém o gradient escuro neutro atual (sem tonalizar).
- `STATUS_MAP` (cores fixas do pie chart) — **não alterar**, é dado semântico de status, não tema.

### 4. Reatividade
- `applyTheme()` em `visualTheme.ts` já dispara `setProperty` em `documentElement.style`. O `MutationObserver` no hook capta isso e força re-render do canvas/aurora.
- CSS puro do `InternalBackground` atualiza automaticamente sem JS.

### 5. QA
- Trocar entre os 7 presets no modal Aparência e verificar Dashboard (Home) + páginas com `InternalBackground` (Galerias, Clientes etc.) em light/dark.
- Mono: confirmar esferas/orbits em escala de cinza, sem nenhum tom de cor saturada.
- Reduced motion: canvas 3D continua oculto.
- Sem regressão em `ClientGallery` (usa `applyTheme` próprio do fotógrafo).

## Arquivos a alterar

- `src/lib/brandColor.ts` (novo)
- `src/components/InternalBackground.tsx`
- `src/pages/Home.tsx`

Sem mudanças em DB, edge functions, lógica de cobrança ou InfinitePay.