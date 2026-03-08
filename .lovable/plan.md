

## Corrigir Contraste do Dashboard Light Mode

### Problemas Identificados

1. **Fundo muito bege/escuro** — o gradiente base usa `#fdf0e6 → #f5dcc4 → #fdf0e6`, que é bege saturado demais. Precisa ser mais claro/branco para os anéis se destacarem.
2. **Anéis e esferas muito apagados** — opacidade dos anéis no light mode começa em `0.1` e sobe `+0.03` por anel (max ~0.19). Esferas começam em `0.3`. Precisam ser mais visíveis.
3. **Cards não parecem translúcidos** — mesmo com `--card: 0.38`, o fundo bege saturado por baixo faz tudo parecer sólido. Com fundo mais claro, a translucidez vai aparecer.
4. **Header inconsistente** — no dashboard o fundo é o gradiente bege; nas internas é o `InternalBackground`. O header usa `bg-white/40` em ambos, mas o contraste muda por causa do fundo diferente. Nenhuma mudança necessária no header — o problema é o fundo bege.

### Mudanças

**`src/pages/Home.tsx`**

1. **Gradiente base light** — clarear significativamente:
   - De: `#fdf0e6 → #f5dcc4 → #fdf0e6`
   - Para: `#fefaf6 → #f8ece0 → #fefaf6` (quase branco com toque cream)

2. **Opacidade dos anéis light** — aumentar contraste:
   - De: `0.1 + index * 0.03` (range 0.10–0.19)
   - Para: `0.25 + index * 0.06` (range 0.25–0.43)

3. **Opacidade das esferas light** — aumentar:
   - De: `0.3 + (index % 3) * 0.1`
   - Para: `0.5 + (index % 3) * 0.12`

4. **Glow zones light** — aumentar levemente opacidade para dar profundidade sem escurecer demais:
   - De: `0.08, 0.07, 0.06`
   - Para: `0.10, 0.09, 0.08`

### Arquivos
- `src/pages/Home.tsx` (linhas 93, 117, 179, 205, 215, 225)

