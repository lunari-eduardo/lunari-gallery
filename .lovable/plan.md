

## Corrigir Rotação dos Anéis Orbitais do Dashboard

### Problema
Os 4 anéis têm velocidades e sentidos de rotação muito parecidos, criando um movimento desordenado e visualmente confuso. Todos giram com `speedX` e `speedY` entre 0.003 e 0.005 — praticamente iguais.

### Solução
Cada anel deve girar em um **sentido claramente diferente** conforme solicitado:

| Anel | Orientação Inicial | Sentido de Rotação |
|------|---------------------|-------------------|
| 0 | Diagonal (45°) | X+ / Y+ |
| 1 | Diagonal oposta (-45°) | X- / Y- |
| 2 | Vertical (90°) | Apenas Y+ |
| 3 | Horizontal (0°) | Apenas X+ |

### Mudança em `src/pages/Home.tsx`

**`RING_CONFIGS`** (linha 67-72):
```ts
const RING_CONFIGS = [
  // Diagonal 1 — gira em X+ e Y+
  { color: TERRA_COTA[0], rotation: [Math.PI / 4, 0, 0], speedX: 0.004, speedY: 0.006 },
  // Diagonal 2 (oposta) — gira em X- e Y-
  { color: TERRA_COTA[1], rotation: [-Math.PI / 4, 0, Math.PI / 2], speedX: -0.005, speedY: -0.004 },
  // Vertical — gira apenas no eixo Y
  { color: TERRA_COTA[2], rotation: [Math.PI / 2, 0, 0], speedX: 0.0, speedY: 0.005 },
  // Horizontal — gira apenas no eixo X
  { color: TERRA_COTA[3], rotation: [0, 0, Math.PI / 2], speedX: 0.005, speedY: 0.0 },
];
```

Também **remover a rotação global do grupo** (`OrbitalScene` linhas 127-130) que adiciona rotação extra sobre tudo, bagunçando os sentidos individuais. Substituir por rotação Y muito lenta (0.001) só para dar vida, sem interferir nos sentidos dos anéis.

```ts
useFrame((_, delta) => {
  groupRef.current.rotation.y += 0.001 * delta;
});
```

### Arquivo modificado
- `src/pages/Home.tsx` — linhas 67-72 (RING_CONFIGS) e 127-130 (OrbitalScene useFrame)

