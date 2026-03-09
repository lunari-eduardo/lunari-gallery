

## Unificar barra de desconto na barra inferior

### Problema
A `DiscountProgressBar` é um componente fixo separado posicionado acima da `SelectionSummary` (bottom bar), ocupando espaço vertical extra — especialmente problemático no mobile.

### Solução
Eliminar o `DiscountProgressBar` como componente flutuante separado e integrá-lo diretamente dentro do `SelectionSummary` (variant `bottom-bar`).

### Arquivos alterados

**1. `src/components/SelectionSummary.tsx`**
- Receber as mesmas props que o `DiscountProgressBar` precisa: `regrasCongeladas`, `saleSettings`, `includedPhotos`, `selectedCount`
- No variant `bottom-bar`, quando houver faixas de desconto e `selectedCount >= includedPhotos`:
  - **Desktop**: Adicionar uma faixa fina acima dos controles (dentro do mesmo container fixo) com os segmentos de tier + texto de status — tudo compacto em uma linha
  - **Mobile**: Layout condensado — segmentos de tier como dots/pills menores, texto de status em fonte `text-[10px]`, botão Confirmar menor (`size="default"` ao invés de `lg`)
- Usar `useIsMobile()` para adaptar layout
- Manter efeito glassmorphic no container unificado: `backdrop-blur-xl bg-card/80 border-t border-border/30`

**2. `src/pages/ClientGallery.tsx`**
- Remover o `<DiscountProgressBar />` separado (linhas 1840-1848)
- Passar props de desconto ao `SelectionSummary`: `saleSettings`, `selectedCount` (já tem `regrasCongeladas`)

**3. `src/components/DiscountProgressBar.tsx`**
- Exportar apenas a lógica de análise como hook `useDiscountAnalysis()` para reuso dentro do `SelectionSummary`
- Manter o componente visual como export secundário caso seja usado em outro lugar

### Layout unificado (desktop)
```text
┌──────────────────────────────────────────────────┐
│ [▬▬▬▬ Base] [▬▬▬▬ -40%] [░░░░ -60%]  ✨ +2 fotos para 40% │  ← tier bar (h-1.5)
├──────────────────────────────────────────────────┤
│ 6 /1  +5 extras  R$ 0.00          [✓ Confirmar] │  ← bottom bar
└──────────────────────────────────────────────────┘
```

### Layout unificado (mobile)
```text
┌───────────────────────────────────┐
│ [▬▬] [▬▬] [░░]  ✨ +2 → 40%     │  ← tier compacto (text-[9px])
├───────────────────────────────────┤
│ 6/1 +5 extras R$0  [✓ Confirmar] │  ← fontes menores, botão compact
└───────────────────────────────────┘
```

