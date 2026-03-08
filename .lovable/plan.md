

## Ajustar velocidade e fundo do Dashboard

### Mudanças em `src/pages/Home.tsx`

**1. Reduzir velocidade em 50%** — dobrar os períodos de rotação dos anéis e esferas:
- Ring 1: 36s → 72s
- Ring 2: 48s → 96s
- Ring 3: 60s → 120s
- Ring 4: 72s → 144s

**2. Escurecer o fundo dark mode** — remover o tom laranja/marrom, usar tons mais neutros e escuros:
- De: `#1A0F0A → #251408 → #1A0F0A`
- Para: `#0D0A08 → #141010 → #0D0A08` (quase preto com toque mínimo warm)

**3. Reduzir intensidade das glow zones** — diminuir saturação e luminosidade para menos laranja:
- Glow top-left: de `hsl(24 70% 63%)` para `hsl(24 40% 45%)`
- Glow bottom-right: de `hsl(20 55% 44%)` para `hsl(20 30% 35%)`

### Arquivo
- `src/pages/Home.tsx` (linhas 67-76 para períodos, 174-175 para gradiente, 199-213 para glows)

