

## Melhorar efeito glassmorphism no modo light

### Problema
Fundo e cards têm luminosidade muito similar, criando uma "superfície única" sem separação de camadas. O efeito vidro não aparece.

### Mudanças

**1. `src/index.css` — Glass tokens light mode (linhas 61-64)**

Aumentar transparência dos cards e adicionar sombra com elevação:

```css
--glass-bg: 0 0% 100% / 0.55;
--glass-border: 0 0% 100% / 0.60;
--glass-shadow: 0 8px 25px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.04);
```

**2. `src/index.css` — Classe `.glass` (linhas 189-194)**

Adicionar gradiente interno para simular refração de vidro no light mode:

```css
.glass {
  @apply backdrop-blur-xl rounded-2xl border transition-all duration-300;
  background: linear-gradient(180deg, hsl(0 0% 100% / 0.75), hsl(0 0% 100% / 0.45));
  border-color: hsl(var(--glass-border));
  box-shadow: var(--glass-shadow);
}
```

Mover o gradiente para funcionar apenas no light mode (dark mantém o token `--glass-bg` original). Usar seletor `:root:not(.dark)` ou aplicar via variável CSS.

**3. `src/pages/Home.tsx` — Gradiente base light (linha 176)**

Substituir gradiente uniforme por base + pontos de luz:

```
background: #F6EFE9;
+ radial-gradient(circle at 20% 10%, rgba(242,140,82,0.12), transparent 40%)
+ radial-gradient(circle at 80% 90%, rgba(255,200,150,0.10), transparent 45%)
```

Isso cria profundidade no fundo, fazendo os cards translúcidos se destacarem.

**4. `src/pages/Home.tsx` — STATUS_MAP cores (linhas 43-49)**

Reduzir saturação das cores do gráfico para tons mais pastel no light mode:

| Status | Atual | Novo |
|--------|-------|------|
| Criadas | `#C9CED6` | `#C9CED6` (ok) |
| Enviadas | `#4A90E2` | `#7EB0E8` |
| Em seleção | `#F28C52` | `#F2A878` |
| Concluídas | `#4CAF7A` | `#7EC9A0` |
| Expiradas | `#F26B6B` | `#E89090` |

### Arquivos
- `src/index.css` (tokens glass + classe .glass)
- `src/pages/Home.tsx` (gradiente light + cores gráfico)

