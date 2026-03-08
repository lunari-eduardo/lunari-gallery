

## Correção do Background 3D Orbital — Especificações Exatas

### Problema
A implementação atual não segue as especificações do prompt: rotações dos anéis estão erradas, partículas não usam quaternion para seguir os anéis, espessura/tamanho incorretos, câmera e FOV diferentes, e as glow zones não usam as posições/cores certas.

### Mudanças em `src/pages/Home.tsx` — apenas `DashboardBackground` e componentes 3D

**1. RING_CONFIGS** — Substituir completamente:
- 4 anéis com raio 6.0, espessura **0.012** (não 0.035), segmentos **16×120**
- Rotações em Euler (radianos): `[π/2, 0, 0]`, `[0, 0, 0]`, `[π/4, π/4, 0]`, `[-π/4, π/4, 0]`
- Velocidades individuais: 0.024, 0.02, 0.016, 0.028
- Cores: `#c2956a`, `#d2691e`, `#cd853f`, `#b8652a`
- Opacidade light: `0.1 + (i × 0.03)` → 0.10, 0.13, 0.16, 0.19
- Opacidade dark: `0.10 + (i × 0.04)` → 0.10, 0.14, 0.18, 0.22

**2. TorusRing** — Refatorar:
- Geometria: `args={[6.0, 0.012, 16, 120]}`
- Rotação inicial via Euler do config (não rotX/rotZ genéricos)
- Cada anel gira no próprio eixo Y com sua velocidade individual
- Todo o grupo (`<group>`) gira no eixo Y global a `t * 0.032`

**3. SPHERE_CONFIGS** — Substituir:
- 3 partículas: tamanhos 0.06, 0.048, 0.072
- Velocidades: 0.096, 0.08, 0.064
- Offsets: 0, π, 1.2
- Partículas 0 e 1 no anel 0, partícula 2 no anel 2

**4. OrbitingSphere** — Refatorar com quaternion:
- Calcular posição local: `[cos(angle) * 6, sin(angle) * 6, 0]`
- Aplicar quaternion do anel correspondente (`new THREE.Quaternion().setFromEuler(...)`) para manter a partícula na linha do torus
- Opacidade light: `0.3 + ((i%3) × 0.1)`, dark: `0.4 + ((i%3) × 0.1)`

**5. OrbitalScene** — Envolver tudo em `<group>` com rotação Y global (`t * 0.032`)

**6. Camera** — `position={[0, 0, 10]}`, `fov={60}`

**7. Glow Zones** — Atualizar posições e cores:
- Zona 1: `top-[10%] left-[30%]`, 40vw, `hsl(24 35% 59% / 0.12)`, blur 80px, opacity 0.08/0.05
- Zona 2: `top-[45%] right-[20%]`, 35vw, `hsl(20 50% 44% / 0.15)`, blur 100px, opacity 0.07/0.04
- Zona 3: `bottom-[5%] left-[15%]`, 30vw, `hsl(24 70% 42% / 0.12)`, blur 90px, opacity 0.06/0.05

### Arquivo modificado
- `src/pages/Home.tsx` — linhas 64-215 (configs + componentes 3D + DashboardBackground). Lógica do dashboard inalterada.

