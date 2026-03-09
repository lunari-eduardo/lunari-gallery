

## Corrigir visibilidade e redesign da DiscountProgressBar

### Problemas identificados

1. **Barra aparece antes do cliente atingir o mínimo do pacote** — Com 12/45 fotos selecionadas, `totalExtrasAcumuladas` retorna 0 mas a barra ainda renderiza porque `faixas.length >= 2` é suficiente para mostrar.
2. **Valores de desconto mostrados sem contexto** — Os -2%, -10%, -18% aparecem mesmo sem extras, confundindo o cliente.
3. **Design básico** — Sem efeito glassmorphism, barra fina sem refinamento visual.

### Mudanças

**1. `src/pages/ClientGallery.tsx` — Passar `selectedCount` e `includedPhotos` corretamente**
- Adicionar prop `selectedCount` ao `DiscountProgressBar`
- A barra só renderiza quando `selectedCount >= includedPhotos` (cliente atingiu o mínimo do pacote)

**2. `src/components/DiscountProgressBar.tsx` — Lógica + Redesign**

**Lógica:**
- Nova prop `selectedCount` (total de fotos selecionadas)
- Retornar `null` se `selectedCount < includedPhotos` — barra invisível até atingir o pacote
- Quando `totalExtras === 0` (acabou de atingir o mínimo), mostrar mensagem incentivando: "Selecione mais fotos para ativar descontos"
- Barra reage em tempo real — ao remover fotos abaixo do mínimo, desaparece; ao adicionar, reaparece

**Design glassmorphic:**
- Container com `backdrop-blur-xl`, background translúcido (`bg-white/60 dark:bg-black/40`), borda refração (`border-white/30`)
- Segmentos de tier com gradiente animado (tier ativo pulsa suavemente)
- Ícone de desconto (`Sparkles`) no lugar do `Tag`
- Tipografia refinada com peso e cores mais expressivas
- Transição suave de entrada (`animate-slide-up`) quando a barra aparece
- Cantos arredondados (`rounded-2xl`) consistente com o design system

### Arquivos alterados
- `src/components/DiscountProgressBar.tsx` — lógica de visibilidade + redesign completo
- `src/pages/ClientGallery.tsx` — passar `selectedCount` como prop

