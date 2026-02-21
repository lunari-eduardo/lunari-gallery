
# Redesign: Checkout com Upgrade Estrategico + Layout Desktop

## Resumo

Reestruturar a pagina de checkout para separar claramente creditos avulsos (parte superior) dos planos mensais (bloco estrategico abaixo), com design persuasivo, mais respiro visual e micro-trigger entre as secoes. Redesenhar tambem a pagina de creditos com o mesmo posicionamento estrategico dos upgrades.

## 1. Pagina de Checkout (`src/pages/CreditsCheckout.tsx`)

### Estrutura da pagina

```text
[Header: Voltar | Compra de Creditos]

[Titulo + subtitulo com "creditos nao vencem"]

[CREDITOS AVULSOS - label]
  Select 2k  |  2.000 creditos  |  R$ 19,90
  Select 5k  |  5.000 creditos  |  R$ 39,90
  Select 10k | 10.000 creditos  |  R$ 69,90
  Select 15k | 15.000 creditos  |  R$ 94,90

[Checkout inline quando avulso selecionado]

[Micro-trigger: "Usa creditos com frequencia? Um plano mensal pode sair mais vantajoso."]

[--- Bloco de upgrade com fundo diferenciado ---]
  Headline: "Cresca com uma estrutura completa"
  Subtexto: "Para quem quer integrar gestao, selecao e armazenamento..."

  CARD 1: Studio Pro + Select 2k
    - Lista de beneficios (bullet points)
    - R$ 44,90/mes (preco grande)
    - Botao: "Quero integrar"

  CARD 2: Studio Pro + Select 2k + Transfer 20GB
    - Tag "Mais completo" no topo
    - Lista de beneficios
    - R$ 64,90/mes (preco grande)
    - Botao: "Estruturar meu negocio"

[Checkout inline quando combo selecionado]
```

### Mudancas visuais detalhadas

- **Secao de creditos avulsos**: mantida como esta (lista vertical simples, funciona bem)
- **Micro-trigger**: frase discreta entre avulsos e upgrades: "Usa creditos com frequencia? Um plano mensal pode sair mais vantajoso no longo prazo." -- texto pequeno, cor muted, sem destaque excessivo
- **Bloco de upgrade**: fundo `bg-muted/50` com `rounded-lg` e padding generoso (p-6 a p-8), separado visualmente
- **Cards de upgrade**: padding interno 24-32px, layout vertical com bullet points dos beneficios
- **Card 2**: tag "Mais completo" como Badge pequeno acima do titulo
- **Precos**: tamanho maior que titulo (`text-2xl font-bold`), cor primary -- preco vende
- **Botoes**: largura natural do conteudo (nao `w-full`), com padding lateral generoso
- **Botao card 1**: "Quero integrar" -- variant default
- **Botao card 2**: "Estruturar meu negocio" -- variant default
- **Checkout inline**: aparece abaixo do card selecionado (seja avulso ou combo), com fundo branco puro e sombra leve

### Largura da pagina

Aumentar de `max-w-lg` para `max-w-2xl` para dar mais respiro no desktop. Os cards de upgrade ficam lado a lado em telas maiores (`grid grid-cols-1 md:grid-cols-2`).

## 2. Pagina de Creditos (`src/pages/Credits.tsx`)

### Mudancas na secao de upgrades

Substituir os cards simples atuais por um bloco estrategico similar ao checkout:

- Headline: "Cresca com uma estrutura completa"
- Subtexto estrategico
- Card 1: Studio Pro + Select 2k com beneficios e botao "Quero integrar"
- Card 2: Estrutura Completa com tag "Mais completo" e botao "Estruturar meu negocio"
- Fundo diferenciado (`bg-muted/50`)
- Preco em destaque

## Detalhes tecnicos

### `src/pages/CreditsCheckout.tsx`

Mudancas:
- Aumentar `max-w-lg` para `max-w-2xl` no container principal
- Adicionar micro-trigger entre avulsos e bloco de upgrade
- Substituir a secao de "Planos mensais" (lista simples) por bloco estrategico com:
  - Fundo `bg-muted/50 rounded-lg p-6 md:p-8`
  - Headline "Cresca com uma estrutura completa" (`text-lg font-semibold`)
  - Subtexto descritivo
  - Grid 1-2 colunas com cards de upgrade
  - Cada card: border, bg-card, p-6, lista de beneficios, preco grande, botao natural-width
  - Card 2: Badge "Mais completo" acima
- Os cards de combo continuam selecionaveis (onClick seta selectedPackage)
- Checkout inline aparece abaixo do bloco quando combo selecionado
- Botoes com `className="px-6"` em vez de `w-full`

### `src/pages/Credits.tsx`

Mudancas:
- Substituir secao de upgrades atual (linhas 144-197) por bloco estrategico:
  - Fundo diferenciado
  - Headline + subtexto
  - 2 cards com beneficios
  - Botoes "Quero integrar" e "Estruturar meu negocio" (ambos com `toast.info('Em breve!')`)

## Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `src/pages/CreditsCheckout.tsx` | Bloco estrategico de upgrade, micro-trigger, layout mais largo, cards com beneficios |
| `src/pages/Credits.tsx` | Secao de upgrades redesenhada com posicionamento estrategico |
