
# Pagina de Planos Unificada -- Select + Transfer com Toggle

## Resumo

Transformar a pagina `CreditsCheckout` em uma pagina unificada de planos com um **toggle no topo** que alterna entre "Gallery Select" e "Gallery Transfer". A aba Transfer exibe 4 cards de armazenamento (5GB, 20GB, 50GB, 100GB) com toggle mensal/anual e um bloco combo no final. Sem configurar checkout real (API Asaas futura).

---

## Estrutura da pagina

```text
HEADER (Voltar)

HERO (muda conforme tab ativa)
  [Gallery Select]  [Gallery Transfer]   <-- toggle no topo

--- Se Select ativo ---
  Cards avulsos (4 colunas) -- existente
  Micro-trigger
  Combos Select -- existente
  Tabela comparativa -- existente

--- Se Transfer ativo ---
  Toggle Mensal / Anual (com badge -20%)
  
  4 Cards de planos (grid 4 colunas desktop / 1 mobile):
    5GB    | 20GB (destaque) | 50GB    | 100GB
    R$12,90| R$24,90         | R$34,90 | R$59,90
    
  Bloco Combo Transfer (full width):
    Studio Pro + Select 2k + Transfer 20GB
    R$ 64,90/mês | R$ 661,98/ano
    [Conhecer plano completo]
```

---

## Detalhes tecnicos

### Arquivo: `src/pages/CreditsCheckout.tsx`

**1. Novo state para tab ativa**
```typescript
const [activeTab, setActiveTab] = useState<'select' | 'transfer'>('select');
```

**2. Dados estaticos dos planos Transfer**
```typescript
const TRANSFER_PLANS = [
  { name: '5GB', monthlyPrice: 1290, yearlyPrice: 12384, storage: '5GB', highlight: false },
  { name: '20GB', monthlyPrice: 2490, yearlyPrice: 23904, storage: '20GB', highlight: true, tag: 'Mais escolhido' },
  { name: '50GB', monthlyPrice: 3490, yearlyPrice: 33504, storage: '50GB', highlight: false },
  { name: '100GB', monthlyPrice: 5990, yearlyPrice: 57504, storage: '100GB', highlight: false },
];

const BENEFITS_TRANSFER = [
  { icon: Users, label: 'Galerias atreladas ao cliente' },
  { icon: Camera, label: 'Entrega profissional' },
  { icon: ShieldCheck, label: 'Acesso rapido e estavel' },
  { icon: Image, label: 'Expansao conforme necessidade' },
  { icon: Check, label: 'Download do arquivo original' },
];
```

**3. Hero dinamico**
- Badge muda: "Creditos" vs "Armazenamento"
- Titulo muda: Select fala de selecao, Transfer fala de entrega profissional
- Subtitulo muda conforme contexto
- Pill de saldo: Select mostra creditos, Transfer mostra "Sem plano ativo" (placeholder)

**4. Toggle Select/Transfer no hero**
- Pill toggle (estilo identico ao mensal/anual) posicionado abaixo do titulo
- Duas opcoes: "Gallery Select" e "Gallery Transfer"

**5. Conteudo condicional**
- `activeTab === 'select'`: renderiza tudo que ja existe (cards avulsos, combos, tabela)
- `activeTab === 'transfer'`: renderiza toggle mensal/anual + cards Transfer + bloco combo

**6. Cards Transfer**
- Mesmo padrao visual exato dos cards Select: `rounded-2xl border bg-card p-8`, mesma sombra, mesma hierarquia
- Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6`
- 20GB com destaque: `border-primary shadow-md ring-1 ring-primary/20` + badge "Mais escolhido"
- Toggle mensal/anual controla qual preco aparece
- No modo mensal: "R$ 24,90 /mes" + linha "Ou R$ 239,04 por ano (20% off)"
- No modo anual: "R$ 239,04 /ano" + linha "Equivale a R$ 19,92/mes"
- Botao: "Assinar" (toast "Em breve!" por enquanto)

**7. Bloco combo Transfer**
- Titulo: "Integre com gestao e selecao"
- Subtitulo: "Combine armazenamento com gestao completa e selecao profissional."
- Card unico com destaque sutil (`border-primary/50 bg-primary/5`)
- Nome: "Studio Pro + Select 2k + Transfer 20GB"
- Preco: segue o toggle mensal/anual (R$ 64,90/mes ou R$ 661,98/ano)
- Botao: "Conhecer plano completo" (toast "Em breve!")

---

## Arquivo modificado

| Arquivo | Mudanca |
|---|---|
| `src/pages/CreditsCheckout.tsx` | Adicionar toggle Select/Transfer, dados e renderizacao dos planos Transfer, bloco combo Transfer |

Nenhum arquivo novo. Nenhuma rota nova. Checkout nao sera configurado (aguardando API Asaas).
