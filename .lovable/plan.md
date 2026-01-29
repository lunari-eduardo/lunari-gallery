
# Plano: Página Dedicada de Checkout de Créditos

## Problema Atual

O fluxo de compra de créditos usa modais encadeados que limitam a experiência:
- Formulários espremidos (especialmente cartão)
- Interface do Gallery visível ao fundo disputa atenção
- Sensação de ação secundária quando é uma compra importante
- Dificuldade de evolução futura (parcelamento, cupons, etc.)

## Solução Proposta

Criar uma **página dedicada** em `/credits/checkout` com layout profissional:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  ← Voltar                                   Lunari                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  COMPRAR CRÉDITOS                                                           │
│  Escolha seu pacote e finalize a compra                                     │
│                                                                             │
├───────────────────────────────────┬─────────────────────────────────────────┤
│                                   │                                         │
│  ┌─────────┐ ┌─────────┐          │   📦 RESUMO DO PEDIDO                   │
│  │ Starter │ │  Basic  │          │   ───────────────────                   │
│  │  2.000  │ │  5.000  │          │                                         │
│  │ R$ 19   │ │ R$ 39   │          │   Pacote: Pro                           │
│  └─────────┘ └─────────┘          │   10.000 créditos                       │
│  ┌─────────┐ ┌─────────┐          │   R$ 69,00                              │
│  │   Pro   │ │Enterp.  │          │                                         │
│  │ 10.000  │ │ 20.000  │          │   ─────────────────────────────         │
│  │ R$ 69  ✓│ │ R$ 99   │          │                                         │
│  └─────────┘ └─────────┘          │   📧 E-mail para recibo                 │
│                                   │   [eduardo22diehl@gmail.com]            │
│                                   │                                         │
│                                   │   💳 Método de Pagamento                │
│                                   │   [PIX] [Cartão]                        │
│                                   │                                         │
│                                   │   (Formulário dinâmico)                 │
│                                   │                                         │
│                                   │   [══════ PAGAR R$ 69,00 ══════]        │
│                                   │                                         │
│                                   │   🔒 Pagamento seguro via Mercado Pago  │
│                                   │                                         │
└───────────────────────────────────┴─────────────────────────────────────────┘
```

## Arquitetura de Arquivos

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/pages/CreditsCheckout.tsx` | **CRIAR** | Nova página dedicada de checkout |
| `src/App.tsx` | Modificar | Adicionar rota `/credits/checkout` |
| `src/pages/Credits.tsx` | Modificar | Botão redireciona para nova página |
| `src/components/credits/CreditPackagesModal.tsx` | Manter | Pode ser removido ou mantido como fallback |
| `src/components/credits/CreditCheckoutModal.tsx` | Manter | Lógica será reutilizada na página |

## Detalhes de Implementação

### 1. Nova Página: `CreditsCheckout.tsx`

**Layout Desktop (lg+):**
- Grid de 2 colunas: `lg:grid-cols-5`
- Coluna esquerda (3/5): Seleção de pacotes em grid 2x2
- Coluna direita (2/5): Card de checkout fixo/sticky

**Layout Mobile:**
- Tudo em coluna única
- Pacotes em carrossel horizontal ou grid 2x2
- Checkout abaixo da seleção

**Componentes internos:**
```tsx
// Estados principais
const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);
const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit_card'>('pix');
const [email, setEmail] = useState(user?.email || '');
const [pixData, setPixData] = useState<PixData | null>(null);
const [paymentSuccess, setPaymentSuccess] = useState(false);

// Navegação após sucesso
const handleSuccess = () => {
  toast.success('Créditos adicionados!');
  navigate('/credits');
};
```

**Estrutura JSX:**
```tsx
<div className="min-h-screen bg-muted/30">
  {/* Header com botão voltar */}
  <header className="border-b bg-background">
    <div className="container py-4 flex items-center">
      <Button variant="ghost" onClick={() => navigate('/credits')}>
        <ArrowLeft /> Voltar
      </Button>
    </div>
  </header>

  <main className="container py-8">
    <div className="lg:grid lg:grid-cols-5 lg:gap-8">
      {/* Coluna de Pacotes */}
      <div className="lg:col-span-3 space-y-6">
        <div>
          <h1>Comprar Créditos</h1>
          <p>Escolha seu pacote e finalize a compra</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {packages?.map(pkg => (
            <PackageCard 
              key={pkg.id}
              selected={selectedPackage?.id === pkg.id}
              onClick={() => setSelectedPackage(pkg)}
            />
          ))}
        </div>
      </div>

      {/* Coluna de Checkout */}
      <div className="lg:col-span-2 mt-8 lg:mt-0">
        <Card className="lg:sticky lg:top-8">
          {paymentSuccess ? (
            <SuccessDisplay />
          ) : pixData ? (
            <PixPaymentDisplay ... />
          ) : selectedPackage ? (
            <CheckoutForm ... />
          ) : (
            <EmptyState />
          )}
        </Card>
      </div>
    </div>
  </main>
</div>
```

### 2. Modificar `App.tsx`

Adicionar nova rota protegida:

```tsx
import CreditsCheckout from "./pages/CreditsCheckout";

// Na lista de rotas:
<Route path="/credits/checkout" element={
  <ProtectedRoute>
    <CreditsCheckout />
  </ProtectedRoute>
} />
```

**Nota:** Página de checkout **não usa Layout** para experiência focada.

### 3. Modificar `Credits.tsx`

Alterar botão "Comprar Créditos" para navegar:

```tsx
import { useNavigate } from 'react-router-dom';

// No componente:
const navigate = useNavigate();

// No botão:
<Button 
  onClick={() => navigate('/credits/checkout')} 
  className="w-full"
  size="lg"
>
  <ShoppingCart className="h-4 w-4 mr-2" />
  Comprar Créditos
</Button>
```

Remover imports e estado dos modais que não serão mais usados.

## Benefícios da Solução

| Aspecto | Antes (Modais) | Depois (Página) |
|---------|----------------|-----------------|
| Espaço para formulário | ~400px largura | ~500px+ sticky |
| Foco do usuário | Dividido com fundo | 100% no checkout |
| Mobile | Modal sobre modal | Fluxo natural scroll |
| Evolução | Difícil adicionar campos | Fácil expandir |
| URL compartilhável | Não | Sim (`/credits/checkout`) |
| Profissionalismo | Médio | Alto |

## Estados da Página

```text
1. SELEÇÃO
   └─ Usuário escolhe pacote

2. CHECKOUT (pacote selecionado)
   └─ Formulário de e-mail + método de pagamento

3. PIX GERADO
   └─ QR Code + Copia e Cola + polling

4. SUCESSO
   └─ Animação de confirmação → redireciona para /credits
```

## Ordem de Implementação

1. **Criar `CreditsCheckout.tsx`** - Página completa com todo o fluxo
2. **Modificar `App.tsx`** - Adicionar rota
3. **Modificar `Credits.tsx`** - Trocar modal por navegação
