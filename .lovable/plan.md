

# Redesign Completo: Pagina de Compra de Creditos

## Resumo

Reescrever completamente `src/pages/CreditsCheckout.tsx` como uma pagina SaaS premium com hero degradê, cards horizontais de pacotes avulsos, secao de combos com toggle mensal/anual, botoes institucionais e tabela comparativa. O checkout (PIX) sera movido para uma nova pagina dedicada (`/credits/checkout/pay`).

## Estrutura da Nova Pagina

```text
[Header: Voltar]

[HERO com degradê suave]
  Badge: "Creditos"
  Titulo: "Organize e profissionalize o processo de selecao de fotos"
  Subtexto: "Creditos flexiveis, sem validade e sem mensalidade."
  Pill de saldo: "Creditos disponiveis: X.XXX"
  Micro-texto: "Seus creditos nao expiram..."

[GRID 4 CARDS - Select Avulso]
  Select 2k | Select 5k | Select 10k (destaque) | Select 15k
  Cada card: nome, creditos, preco grande, botao "Comprar", lista de beneficios
  Desktop: 4 colunas | Mobile: 1 coluna

[MICRO-TRIGGER]

[SECAO COMBOS]
  Titulo: "Cresca com uma estrutura completa"
  Subtexto estrategico
  Toggle: Mensal | Anual
  2 cards lado a lado:
    Card 1: Studio Pro + Select 2k (R$ 44,90/mes ou R$ 452,59/ano)
    Card 2: Studio Pro + Select 2k + Transfer 20GB (R$ 64,90/mes ou R$ 661,98/ano) -- tag "Mais completo"
  Cada card: lista de beneficios, preco grande, botao "Assinar"

[BOTOES INSTITUCIONAIS]
  "Conheca o Select" | "Conheca o Transfer"

[TABELA COMPARATIVA]
  3 colunas: Select Avulso | Studio Pro + Select | Studio Pro + Select + Transfer
  Linhas: Preco, Clientes ilimitados, Galerias ilimitadas, Resolucao, Creditos mensais, etc.
```

## Arquivos

| Arquivo | Acao |
|---|---|
| `src/pages/CreditsCheckout.tsx` | Reescrever completamente com novo layout |
| `src/pages/CreditsPayment.tsx` | **Novo** -- pagina dedicada de checkout PIX |
| `src/App.tsx` | Adicionar rota `/credits/checkout/pay` |

## Detalhes tecnicos

### `src/pages/CreditsCheckout.tsx` -- Reescrita completa

**Hero superior:**
- Fundo com degradê usando cores do design system: `bg-gradient-to-b from-primary/8 via-primary/3 to-background`
- Altura generosa (~420-500px de conteudo)
- Badge "Creditos" centralizado
- Titulo `text-3xl md:text-4xl font-bold tracking-tight` centralizado
- Subtexto `text-muted-foreground`
- Pill de saldo: borda leve, fundo `bg-card`, exibe saldo do hook `usePhotoCredits`
- Micro-texto abaixo: "Seus creditos nao expiram..."

**Cards de Select Avulso (4 cards):**
- Grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6`
- Cada card: `rounded-2xl border p-8 bg-card`
- Conteudo: nome, creditos, preco (`text-3xl font-bold text-primary`), botao "Comprar" (`px-6`, nao full-width)
- Lista de beneficios (igual em todos): Galerias ilimitadas, Clientes ilimitados, Ate 2560px, Presets de galerias, Sem taxa ou comissao
- Select 10k (sort_order 3): borda `border-primary`, sombra `shadow-md`, tag "Mais escolhido" como Badge

**Ao clicar "Comprar":**
- `navigate('/credits/checkout/pay', { state: { packageId: pkg.id, packageName: pkg.name, credits: pkg.credits, priceCents: pkg.price_cents } })`
- Redireciona para pagina de pagamento dedicada

**Secao de Combos:**
- Margem superior generosa (`mt-20 pt-16`)
- Fundo padrao da pagina (sem degradê)
- Titulo: "Cresca com uma estrutura completa" (`text-2xl font-bold`)
- Toggle Mensal/Anual: componente simples com 2 botoes, state local `billingPeriod: 'monthly' | 'yearly'`
- Precos anuais calculados no frontend: mensal * 12 * 0.84 (16% desconto) -- R$ 452,59 e R$ 661,98
- Ao selecionar Anual, exibir badge "Economize 16%"
- 2 cards `grid-cols-1 md:grid-cols-2 gap-6`
- Card 2: Badge "Mais completo", borda mais evidente
- Botao "Assinar" redireciona para pagina de pagamento

**Botoes institucionais:**
- Centralizados, `variant="outline"`, `onClick={() => toast.info('Em breve!')}`

**Tabela comparativa:**
- 3 colunas + coluna de labels
- Dados estaticos (hardcoded)
- Check icon para incluido, traco para nao incluido
- `rounded-2xl border overflow-hidden shadow-sm`
- Mobile: scroll horizontal com `overflow-x-auto`

### `src/pages/CreditsPayment.tsx` -- Nova pagina

- Recebe dados do pacote via `useLocation().state` ou query params
- Exibe resumo do pacote selecionado
- Campo de email
- Botao "Gerar PIX"
- `PixPaymentDisplay` para QR code
- Estado de sucesso com redirecionamento
- Toda a logica de pagamento movida do antigo checkout
- Layout simples, centrado, `max-w-lg`

### `src/App.tsx`

- Adicionar import de `CreditsPayment`
- Adicionar rota: `<Route path="/credits/checkout/pay" element={<ProtectedRoute><CreditsPayment /></ProtectedRoute>} />`

### Padroes visuais

- `rounded-2xl` nos cards (16px)
- Padding interno minimo 32px (`p-8`)
- Espacamento entre secoes: `space-y-20` ou `mt-20`
- Botoes nunca `w-full` no desktop -- usar `px-6` ou `px-8`
- Precos: `text-3xl font-bold text-primary` nos cards avulsos, `text-2xl` nos combos
- Sombras suaves: `shadow-sm` padrao, `shadow-md` no card destacado
- Cores exclusivas do design system (primary terracotta, muted warm)

### Responsividade

- Cards avulsos: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`
- Cards combo: `grid-cols-1 md:grid-cols-2`
- Tabela: `overflow-x-auto` no mobile
- Hero: tipografia responsiva `text-2xl md:text-4xl`
- Toggle acima dos combos em todas as telas

