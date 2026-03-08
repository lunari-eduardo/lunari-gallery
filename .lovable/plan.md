

## Diagnóstico e Correção dos Anéis 3D Orbitais

### Problema Identificado
Os anéis e esferas estão renderizando, mas são **praticamente invisíveis** por dois motivos:
1. **Tubo do torus muito fino**: `0.015` de raio — quase imperceptível
2. **Esferas minúsculas**: `0.06-0.08` de raio
3. **Opacidades muito baixas** no dark mode (multiplicadas por 0.5)

Comparando com a imagem de referência (image-479), os anéis devem ser linhas finas porém **claramente visíveis**, como fios dourados cruzando a tela.

### Correções em `src/pages/Home.tsx`

**Torus rings:**
- Aumentar tube radius de `0.015` → `0.035` (linhas finas mas visíveis)
- Aumentar opacidades: light `0.25-0.45`, dark `0.15-0.30`
- Ajustar inclinações para criar o efeito "globo da morte" da referência com cruzamentos mais dramáticos

**Esferas orbitantes:**
- Aumentar tamanho de `0.06-0.08` → `0.12-0.18`
- Aumentar opacidade: light `0.9`, dark `0.6`

**Camera:**
- Afastar levemente para `position={[0, 0, 14]}` para enquadrar melhor os anéis grandes

**Configs atualizados:**
```
RING_CONFIGS:
  { color: '#c2956a', opacity: 0.35, rotX: 0.4, rotZ: 0.2 }
  { color: '#d2691e', opacity: 0.28, rotX: -0.6, rotZ: 0.5 }
  { color: '#cd853f', opacity: 0.25, rotX: 0.8, rotZ: -0.4 }
  { color: '#b8652a', opacity: 0.40, rotX: -0.3, rotZ: 0.7 }

SPHERE_CONFIGS:
  sizes: 0.14, 0.12, 0.16
```

### Arquivo
- `src/pages/Home.tsx` — apenas os configs e geometria, sem alteração de lógica

