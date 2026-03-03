

## Plano: Redesign da Seção de Combos — De "Bloco de Venda" para "Bloco de Expansão Estratégica"

### O que muda

A seção de combos (linhas 207-264 de `src/pages/Credits.tsx`) será totalmente redesenhada para ter um tom educativo e aspiracional, reduzindo a pressão de compra e aumentando a percepção premium.

### Alterações em `src/pages/Credits.tsx`

**1. Separação visual clara da parte superior:**
- Remover `bg-muted/50 rounded-xl` (muito similar a um card de checkout)
- Adicionar separador com mais espaço vertical (`pt-8 mt-4 border-t border-border/30`)
- Headline e subtexto reposicionados com tom estratégico

**2. Nova headline e copy:**
- Pergunta racional: *"Você usa créditos com frequência?"*
- Subtexto: *"Talvez um plano integrado faça mais sentido no longo prazo."*
- Headline principal: **"Estruture seu negócio para crescer"**
- Sub: *"Gestão, galerias de seleção e entrega integrados para quem quer escalar com organização."*

**3. Cards horizontais (layout editorial):**
- Cards mudam de grid `md:grid-cols-2` vertical para cards horizontais mais largos (`flex` horizontal em desktop)
- Mais texto explicativo, menos cara de plano
- Preço presente mas não dominante (tamanho menor, alinhado à direita)

**4. CTAs repensados:**
- CTA principal: botão `variant="outline"` com texto **"Conhecer planos"** → navega para checkout
- CTA secundário: link inline pequeno **"Assinar agora →"** abaixo do botão
- Remove botões grandes e diretos como "Quero integrar" e "Estruturar meu negócio"

**5. Card Combo Completo:**
- Mantém badge "Mais completo" mas em tom sutil
- Mesmo padrão editorial: mais texto, CTA "Conhecer estrutura completa", link secundário "Assinar agora"

### Estrutura visual resultante

```text
─────────────── separador sutil ───────────────

"Você usa créditos com frequência?"
"Talvez um plano integrado faça mais sentido."

Estruture seu negócio para crescer
Gestão, seleção e entrega integrados para escalar.

┌─────────────────────────────────────────────┐
│ Studio Pro + Gallery Select 2k              │
│ Para quem quer profissionalizar o fluxo...  │
│ • Gestão completa                           │
│ • 2.000 créditos mensais                    │
│ • Integração com galerias        R$ 44,90/m │
│                                             │
│ [ Conhecer planos ]                         │
│   Assinar agora →                           │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ ◆ Mais completo                             │
│ Studio Pro + Select 2k + Transfer 20GB      │
│ Tudo integrado: gestão, seleção e entrega   │
│ • Gestão completa                           │
│ • Créditos mensais incluídos                │
│ • Entrega profissional           R$ 64,90/m │
│                                             │
│ [ Conhecer estrutura completa ]             │
│   Assinar agora →                           │
└─────────────────────────────────────────────┘
```

### Arquivo modificado

- `src/pages/Credits.tsx` — seção de combos (linhas 207-264)

