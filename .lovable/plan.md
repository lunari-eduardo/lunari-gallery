

## Corrigir barra de progresso de desconto — dinâmica e com layout correto

### Problemas atuais
1. **Sem barra de progresso visual** — só tem texto, sem os segmentos de tier
2. **Travado em "Desconto máximo: 60%! 🎉"** — lógica `atMaxTier` fica true e não reage quando cliente desmarca fotos
3. **Emojis indesejados** na UI

### Mudanças

**`src/components/DiscountProgressBar.tsx` (InlineDiscountTiers)**

- Remover todos os emojis (🎉)
- **Desktop**: Layout em linha única — barra de progresso (segmentos) à **esquerda** do texto, ambos centralizados no espaço disponível
- **Mobile**: Layout em coluna compacta — barra de progresso centralizada **acima** do texto, tudo em `flex-col items-center`
- Barra de progresso sempre visível quando há faixas e `selectedCount >= includedPhotos`
- Segmentos reagem dinamicamente: ao desmarcar foto, `totalExtras` diminui → `faixaAtual` recalcula → segmento ativo volta para faixa anterior
- Textos limpos:
  - `Falta(m) N foto(s) para desconto de X%`
  - `Você tem X% de desconto em extras`
  - `Desconto máximo: X%`

**`src/components/SelectionSummary.tsx`**

- Nenhuma mudança estrutural — o `InlineDiscountTiers` já está integrado no centro da bottom-bar, só precisa do componente atualizado

### Arquivos
- `src/components/DiscountProgressBar.tsx`

