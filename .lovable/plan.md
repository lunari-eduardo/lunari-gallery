

## Correção: Esferas Orbitando Fora dos Anéis

### Causa Raiz
As esferas calculam posição usando o quaternion da rotação **inicial** do anel, mas cada anel também gira continuamente (`rotation.y += speed * delta`). A esfera não acompanha essa rotação adicional, então rapidamente sai da linha do torus.

### Solução
Tornar as esferas **filhas** do mesh do anel correspondente. Assim, a rotação do anel se aplica automaticamente às esferas — sem necessidade de quaternion manual.

### Mudanças em `src/pages/Home.tsx`

**1. Refatorar `TorusRing`** para aceitar esferas como children:
- Receber e renderizar `children` dentro do `<mesh>` (ou `<group>` wrapper)

**2. Refatorar `OrbitingSphere`** — simplificar posicionamento:
- Remover quaternion e `localPos.applyQuaternion`
- Posição local no plano do torus: `[cos(angle) * 6, sin(angle) * 6, 0]`
- Como é filho do ring, a rotação do anel é herdada automaticamente

**3. Refatorar `OrbitalScene`** — aninhar esferas dentro dos anéis:
```tsx
<TorusRing index={0}>
  <OrbitingSphere index={0} />
  <OrbitingSphere index={1} />
</TorusRing>
<TorusRing index={2}>
  <OrbitingSphere index={2} />
</TorusRing>
```

**4. Velocidades mais lentas e suaves:**
- Velocidades dos anéis: reduzir ~40% (0.024→0.014, etc.)
- Velocidades das esferas: reduzir ~50% (0.096→0.048, etc.)
- Rotação global do grupo: 0.032→0.018

