

## Substituir glows radiais por aurora gradient no dashboard

### O que muda

Trocar as duas "glow zones" (divs radiais estáticas) por um aurora gradient animado bege-âmbar que se move suavemente pelo fundo, criando mais profundidade para o efeito vidro.

### Mudanças em `src/pages/Home.tsx`

**1. Base gradient (linha 170-178)**
- Light: fundo branco puro `#FFFFFF` (não mais cream) para maximizar contraste com cards glass
- Dark: manter gradiente escuro atual

**2. Substituir glow zones (linhas 194-214) por aurora**

Criar um `div` absoluto com `background` composto por múltiplos gradientes lineares em ângulos diferentes, com animação CSS `@keyframes aurora` que rotaciona e translada suavemente (~20s cycle):

```
Light mode:
- linear-gradient(120deg, rgba(242,170,100,0.15), transparent 50%)
- linear-gradient(240deg, rgba(255,200,140,0.12), transparent 50%)  
- linear-gradient(0deg, rgba(230,180,130,0.08), transparent 60%)
- filter: blur(60px), animation: aurora 20s ease infinite

Dark mode:
- Mesmos gradientes com opacidade ~0.04-0.06
```

**3. Adicionar keyframes aurora em `src/index.css`**

```css
@keyframes aurora {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  33% { transform: translate(2%, -3%) rotate(2deg); }
  66% { transform: translate(-2%, 2%) rotate(-1deg); }
}
```

### Arquivos
- `src/pages/Home.tsx` — substituir glow zones por aurora div
- `src/index.css` — adicionar keyframes `aurora`

