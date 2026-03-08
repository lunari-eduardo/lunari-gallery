

## Reescrever o Background Orbital 3D do Dashboard

### O que muda

Substituir completamente a cena 3D atual (que parece um "átomo científico" com anéis girando juntos) por um **campo orbital premium** com sensação de profundidade espacial real.

### Arquitetura da nova cena (`src/pages/Home.tsx`)

**4 Anéis orbitais** — cada um em plano diferente, velocidade diferente, direção alternada:

| Anel | Orientação | Período | Direção | Espessura (tube) | Opacidade (light/dark) |
|------|-----------|---------|---------|-------------------|----------------------|
| 1 | rotateX(65°) | 36s | horário | 0.025 | 0.35 / 0.12 |
| 2 | rotateY(45°) | 48s | anti-horário | 0.015 | 0.20 / 0.08 |
| 3 | rotateX(-40°) | 60s | horário | 0.020 | 0.25 / 0.10 |
| 4 | rotateZ(30°) | 72s | anti-horário | 0.012 | 0.12 / 0.06 |

**Cor base dos anéis:** `rgba(242, 140, 82)` (copper/amber Lunari) com variações sutis por anel.

**2 Esferas orbitantes** (reduzidas de 3 para 2):
- Esfera 1 no Anel 1 — offset 0°
- Esfera 2 no Anel 3 — offset 180°
- Glow amber sutil, tamanho pequeno (~0.08), opacidade mais alta que os anéis

**Rotação:** Cada anel gira apenas no seu eixo principal (um único eixo por anel), velocidade convertida de período em segundos para `(2π / período) * delta`. Direções alternadas via sinal positivo/negativo.

**Sem rotação global do grupo** — cada anel é independente, eliminando o efeito "bola girando".

### Gradiente de fundo

- **Dark:** `#1A0F0A` base com gradiente warm (alinhado ao pedido)
- **Light:** mantém `#fefaf6 → #f8ece0` (já ajustado)

### Glow zones

- Top-left: radial amber glow
- Bottom-right: radial copper glow
- Opacidades maiores no dark mode para criar ambiente warm

### Mudanças técnicas

1. **Reescrever `RING_CONFIGS`** — novas rotações iniciais, velocidades baseadas em período, direções alternadas, espessuras variáveis
2. **Reescrever `TorusRing`** — rotação em eixo único por anel (não X+Y simultaneamente), usar tube radius do config
3. **Reduzir `SPHERE_CONFIGS` para 2** — offsets em 0 e π, velocidades sincronizadas com o anel pai
4. **Remover rotação global** do `OrbitalScene` group
5. **Atualizar `OrbitalScene`** — Esfera 1 em Ring 0, Esfera 2 em Ring 2, sem esferas nos outros
6. **Ajustar gradiente dark** para `#1A0F0A`
7. **Reposicionar glow zones** — top-left e bottom-right conforme spec

### Arquivo
- `src/pages/Home.tsx` (linhas 64–237 — seção 3D + background)

