

## Unificar barra de desconto na mesma linha (desktop) e otimizar mobile

### Problema atual
- Desktop: barra de desconto ocupa uma linha separada acima da linha principal, desperdiçando espaço vertical
- Mobile: a barra de desconto + contagem + botão ocupam muito espaço; textos pouco claros

### Mudanças em `src/components/SelectionSummary.tsx`

**Desktop** — eliminar a row separada de desconto. Colocar os tier segments + texto inline **no centro** da mesma linha que já tem contagem à esquerda e botão à direita:
```text
┌──────────────────────────────────────────────────────────────┐
│ 6 /1  +5 extras R$0.00   [▬▬▬▬][▬▬▬▬][░░░░] ✨ +2→40%   [✓ Confirmar] │
└──────────────────────────────────────────────────────────────┘
```
Uma única linha. Discount tiers no `flex-1` central.

**Mobile** — uma única barra compacta, sem row separada:
- Linha 1 (única): `6/1  +5 extras R$0.00` ... `[✓ Confirmar]`
- Se houver desconto, substituir o texto de extras pelo texto motivacional em fonte pequena (`text-[10px]`):
  - `Falta 1 foto para desconto de X%`
  - `Você tem X% de desconto em extras`
  - `Desconto máximo: X%! 🎉`
- Remover tier segments no mobile (ocupam espaço sem agregar valor em tela pequena) — usar apenas texto

### Mudanças em `src/components/DiscountProgressBar.tsx` (`InlineDiscountTiers`)
- Atualizar textos para português mais natural:
  - `Falta {n} foto(s) para desconto de {x}%`
  - `Você tem {x}% de desconto em extras`
  - Max tier: `Desconto máximo: {x}%! 🎉`

### Arquivos alterados
- `src/components/SelectionSummary.tsx` — layout unificado single-line
- `src/components/DiscountProgressBar.tsx` — textos atualizados

