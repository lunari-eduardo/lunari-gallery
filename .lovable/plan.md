
Objetivo: remover a aparência “sólida” no light mode e garantir vidro translúcido real nos cards/blocos do dashboard, preservando bordas.

Diagnóstico (o que está bloqueando hoje):
1) `Home.tsx` já usa `.glass` nos blocos principais, então o problema não é só no dashboard home.
2) Vários blocos “card-like” ainda usam classes sólidas:
   - `src/components/ui/card.tsx`: `bg-card shadow-sm` (sem `backdrop-blur`).
   - `src/components/ui/dialog.tsx` e `src/components/ui/alert-dialog.tsx`: `bg-background` sólido.
   - `src/components/ui/popover.tsx` e `src/components/ui/dropdown-menu.tsx`: `bg-popover` sem blur de vidro.
   - `src/components/ui/input.tsx`: `bg-background` sólido.
   - Em cards do fluxo de galerias, existem blocos internos com `bg-background`/`bg-muted` que “chapam” o visual.
3) Tokens atuais do light estão relativamente opacos para “efeito vidro premium”:
   - `--card: ... / 0.6`
   - `--popover: ... / 0.7`

Plano de implementação:
1) Ajustar tokens de translucidez no light mode (`src/index.css`)
   - Reduzir opacidade de `--card` e `--popover` para faixa mais translúcida (ex.: ~0.38–0.48).
   - Manter `--glass-border` como está (ou levemente mais forte) para não perder contorno.
   - Manter `--glass-bg` em linha com esse ajuste para consistência visual.

2) Tornar os primitives realmente “glass” (`src/components/ui/*`)
   - `card.tsx`: incluir classe `glass` no container base do `Card` (e remover dependência de aparência sólida padrão).
   - `dialog.tsx` e `alert-dialog.tsx`: trocar `bg-background` por estilo translúcido + `backdrop-blur-xl`.
   - `popover.tsx` e `dropdown-menu.tsx`: aplicar fundo translúcido e blur no content.
   - `input.tsx` (apenas onde necessário): reduzir opacidade do fundo para não parecer bloco branco chapado.

3) Remover “ilhas sólidas” nos blocos do dashboard/galerias
   - `src/components/DeliverGalleryCard.tsx`: revisar `bg-background/80` do botão de menu e overlay de expirada.
   - `src/components/PaymentHistoryCard.tsx`: trocar `bg-background` dos itens internos por versão translúcida.
   - Revisar pontos equivalentes no dashboard para evitar fundos opacos dentro de containers glass.

4) Preservar contraste e legibilidade
   - Garantir que texto continue legível após reduzir opacidade.
   - Não mexer em bordas estruturais (`border-border`, `border-border/50`) para manter definição dos cards.

Validação (após aplicar):
1) Verificar no `/dashboard` (light):
   - blocos de métricas, status, atividades recentes e cards com fundo visivelmente translúcido.
2) Verificar no `/galleries/select` e `/galleries/deliver`:
   - `GalleryCard`/`DeliverGalleryCard` com vidro consistente, sem patches sólidos.
3) Validar modais/popovers/dropdowns:
   - aparência glass homogênea em todas as superfícies.
4) Teste visual end-to-end em desktop e mobile para confirmar que transparência + borda ficaram equilibradas.

Arquivos-alvo principais:
- `src/index.css`
- `src/components/ui/card.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/alert-dialog.tsx`
- `src/components/ui/popover.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/input.tsx`
- `src/components/DeliverGalleryCard.tsx`
- `src/components/PaymentHistoryCard.tsx`
