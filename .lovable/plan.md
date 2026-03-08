

## Ajuste do Death Globe — 4 Anéis Simétricos, Rotação Dual-Axis, Mais Lento

### Problema Atual
- Os anéis giram apenas no eixo Y (`rotation.y += speed * delta`), resultando em movimento unidirecional e não simétrico como na imagem de referência.
- As velocidades ainda estão rápidas demais.
- A rotação global do grupo também é só no eixo Y.

### Referência Visual
Na imagem, os 4 anéis cruzam-se simetricamente formando um globo esférico, com rotação lenta e elegante em múltiplos eixos.

### Mudanças em `src/pages/Home.tsx`

**1. Rotações iniciais dos 4 anéis** — distribuir simetricamente em 3D:
```
Anel 0: [0, 0, 0]                    — plano XY (horizontal)
Anel 1: [Math.PI/2, 0, 0]            — plano XZ (vertical frontal)
Anel 2: [Math.PI/3, 0, Math.PI/3]    — inclinado 60°
Anel 3: [-Math.PI/3, 0, -Math.PI/3]  — inclinado -60° (espelho do 2)
```

**2. Rotação dual-axis em cada anel** — girar em X e Y simultaneamente com velocidades diferentes para movimento orgânico:
```tsx
useFrame((_, delta) => {
  ref.current.rotation.x += cfg.speedX * delta;
  ref.current.rotation.y += cfg.speedY * delta;
});
```
Velocidades muito lentas (metade das atuais):
| Anel | speedX | speedY |
|------|--------|--------|
| 0    | 0.003  | 0.005  |
| 1    | 0.005  | 0.003  |
| 2    | 0.004  | 0.004  |
| 3    | 0.004  | -0.004 |

**3. Rotação global do grupo** — dual-axis também, mais lenta:
```tsx
groupRef.current.rotation.x += 0.006 * delta;
groupRef.current.rotation.y += 0.008 * delta;
```

**4. Velocidade das esferas** — reduzir pela metade:
```
Esfera 0: speed 0.024
Esfera 1: speed 0.020
Esfera 2: speed 0.016
```

**5. Espessura dos anéis** — aumentar levemente para `0.018` para ficarem mais visíveis como na referência.

### Arquivo modificado
- `src/pages/Home.tsx` — linhas 67-142 (configs + componentes 3D)

