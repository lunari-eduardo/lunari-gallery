

## Diagnóstico: Por que o Background 3D Não Aparece

### Causa Raiz
O Canvas 3D está renderizando corretamente, mas está **completamente escondido** por camadas opacas acima dele:

1. **`body`** no `index.css` (linha 177): `@apply bg-background` → fundo sólido `hsl(30 40% 96%)` (bege opaco no light) / `hsl(20 15% 6%)` (marrom opaco no dark)
2. **`Layout.tsx`** (linha 61): `<div className="min-h-screen bg-background">` → outro fundo sólido opaco
3. O `DashboardBackground` está em `fixed inset-0 -z-10` — ou seja, **por trás** dessas camadas opacas

```text
Camada visual (de cima para baixo):
┌─────────────────────────────┐
│  Cards / Conteúdo (z-10)    │  ← visível
│  Layout bg-background       │  ← OPACO, bloqueia tudo abaixo
│  body bg-background         │  ← OPACO, bloqueia tudo abaixo  
│  DashboardBackground (-z-10)│  ← Canvas 3D ESCONDIDO
└─────────────────────────────┘
```

### Solução

**Arquivo: `src/pages/Home.tsx`**
- Mover o `DashboardBackground` para **dentro** do fluxo do componente (não `fixed -z-10`), usando `absolute inset-0` dentro de um container relativo
- Ou melhor: tornar o background o primeiro elemento **com z-index positivo** acima do layout

**Arquivo: `src/components/Layout.tsx`**
- Tornar o `bg-background` do wrapper do Layout **transparente** quando a rota for `/dashboard`, para que o background 3D do Home apareça
- Alternativa mais limpa: aceitar uma prop `transparentBg` ou usar uma classe condicional

**Abordagem escolhida (mais limpa):**

1. **`Layout.tsx`**: Detectar a rota `/dashboard` e remover `bg-background` do wrapper, substituindo por `bg-transparent`
2. **`Home.tsx`**: Mudar o `DashboardBackground` de `fixed inset-0 -z-10` para `fixed inset-0 z-0` e garantir que o conteúdo esteja em `z-10` (que já está)
3. **`index.css`**: O `body bg-background` continua, mas o Canvas com `z-0` e o conteúdo com `z-10` resolve — desde que o Layout wrapper não tenha fundo opaco

### Mudanças Específicas

**`src/components/Layout.tsx`** (linha 61):
```tsx
// De:
<div className="min-h-screen bg-background">
// Para:
<div className={cn("min-h-screen", location.pathname === '/dashboard' ? '' : 'bg-background')}>
```

**`src/pages/Home.tsx`** (linha 166):
```tsx
// De:
<div className="fixed inset-0 -z-10 pointer-events-none">
// Para:
<div className="fixed inset-0 z-0 pointer-events-none">
```

Essas duas mudanças fazem o Canvas 3D aparecer no dashboard sem afetar nenhuma outra página.

