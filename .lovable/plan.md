

## Plano: Seção de Expansão com visual de Landing Page

### O que muda

A seção inferior (linhas 207-301) será transformada visualmente para parecer uma mini landing page embutida, com mais respiro, tipografia maior, layout mais dramático e sensação de seção independente.

### Alterações em `src/pages/Credits.tsx`

**1. Container da seção:**
- Trocar `border-t border-border/30` por um fundo sutil diferenciado: `bg-muted/30 -mx-4 px-4 md:-mx-6 md:px-6 py-12 rounded-2xl` (ou usar margem negativa para sangrar o container)
- Mais padding vertical (py-12 em vez de pt-8)

**2. Headline com escala de landing page:**
- Pergunta racional mantida mas com mais espaço
- Headline principal: `text-2xl md:text-3xl font-bold tracking-tight` (escala de hero)
- Subtexto: `text-sm md:text-base text-muted-foreground max-w-lg` (mais legível)
- Centralizar todo o bloco de texto no topo da seção

**3. Cards com mais presença:**
- Grid `md:grid-cols-2` lado a lado em vez de empilhados verticalmente
- Cada card: layout vertical (não horizontal) com mais padding (`p-8`)
- Preço com destaque maior: `text-2xl font-bold` com `/mês` menor
- Benefícios com mais espaçamento
- CTA centralizado no card com mais respiro
- Card do Combo Completo com borda levemente destacada (`border-primary/20`) ou fundo sutil

**4. Tipografia e espaçamento geral:**
- Mais gap entre elementos (space-y-8 entre headline e cards)
- Texto dos benefícios ligeiramente maior (`text-sm` em vez de `text-xs`)
- Ícones dos benefícios maiores (`h-4 w-4`)

### Estrutura visual

```text
┌─────────────────────────────────────────────────────┐
│                  bg-muted/30 rounded                │
│                                                     │
│   Você usa créditos com frequência?                 │
│                                                     │
│   Estruture seu negócio                             │
│   para crescer                                      │
│   Gestão, seleção e entrega integrados...           │
│                                                     │
│   ┌──────────────────┐  ┌──────────────────┐        │
│   │ Studio Pro +     │  │ ◆ Mais completo  │        │
│   │ Select 2k        │  │ Studio + Select  │        │
│   │                  │  │ + Transfer 20GB  │        │
│   │ • Gestão         │  │                  │        │
│   │ • 2k créditos    │  │ • Gestão         │        │
│   │ • Integração     │  │ • Créditos       │        │
│   │                  │  │ • Entrega        │        │
│   │  R$ 44,90/mês    │  │                  │        │
│   │                  │  │  R$ 64,90/mês    │        │
│   │ [Conhecer planos]│  │ [Conhecer tudo]  │        │
│   │  Assinar agora → │  │  Assinar agora → │        │
│   └──────────────────┘  └──────────────────┘        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Arquivo

- `src/pages/Credits.tsx` — linhas 207-301

