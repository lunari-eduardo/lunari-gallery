

## Corrigir color banding nos gradientes radiais

### Problema
Os gradientes radiais com poucos color stops e transições suaves em áreas grandes criam "faixas" visíveis (color banding) — especialmente em fundos escuros com cores de baixa opacidade onde há apenas 8 bits de precisão por canal.

### Solução: Dithering via ruído + mais color stops

**1. `src/components/InternalBackground.tsx`**

- **Mais color stops intermediários** nos gradientes para suavizar as transições (de 5 stops para ~8-10 stops com incrementos menores de opacidade)
- **Aumentar o blur** levemente (18→22px, 16→20px) para difundir ainda mais as bandas
- **Adicionar um overlay de dithering** usando um SVG `feTurbulence` de alta frequência com blend mode — isso quebra as bandas visualmente. Aumentar a opacidade do ruído existente de `0.03` para `0.045` e reduzir `baseFrequency` para `0.65` para um grão mais natural

**2. Detalhes dos gradientes refinados**

Cada gradiente terá stops mais granulares, por exemplo para a esfera direita:
```
rgba(172, 94, 58, 0.35) 0%,
rgba(183, 107, 59, 0.38) 12%,
rgba(194, 120, 60, 0.4) 22%,
rgba(194, 130, 70, 0.33) 32%,
rgba(194, 140, 80, 0.25) 42%,
rgba(194, 140, 80, 0.17) 50%,
rgba(194, 140, 80, 0.1) 58%,
rgba(194, 140, 80, 0.04) 65%,
transparent 75%
```

### Arquivos
- `src/components/InternalBackground.tsx` — gradientes com mais stops + blur maior + ruído ajustado

