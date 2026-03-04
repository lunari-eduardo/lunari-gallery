

## Plano: Checkout Premium com Wizard por Etapas + Correção de Bloqueios

### Problema atual

1. **UX quebrada**: No `CreditsPayment.tsx`, o seletor de parcelamento (Forma de Pagamento) aparece ANTES dos dados pessoais. O formulário `CardCheckoutForm` tem steps internos (`personal` → `card`), mas as parcelas ficam fora dele, no `SubscriptionForm`.

2. **Bug de bloqueio**: `activeSubs` (linha 216 do `CreditsCheckout.tsx`) filtra apenas `ACTIVE | PENDING | OVERDUE`, ignorando assinaturas `CANCELLED` com `next_due_date` futuro. Isso permite que o usuário compre um plano inferior durante período vigente de uma assinatura cancelada.

### Solução

#### 1. Refatorar `CreditsPayment.tsx` — Wizard de 3 Etapas

Substituir o fluxo atual por um wizard unificado com step indicator visual (referência: imagem 1):

```text
Etapa 1: Dados Pessoais          Etapa 2: Pagamento               Etapa 3: Revisão
─────────────────────            ──────────────────                ──────────────
Nome completo                    [Select] PIX / Cartão toggle     Resumo do pedido
CPF ou CNPJ                      [Assin.] À vista / Parcelado     Campo de cupom
E-mail (disabled)                  └ Seletor de parcelas          Preço original (riscado)
Telefone                         Dados do cartão (se cartão)      Preço com desconto
CEP                              Número, Nome, Val, CVV           Botão "Confirmar pagamento"
                                                                  
[Próximo →]                      [← Voltar] [Próximo →]           [← Voltar] [Pagar R$ XX]
```

**Sidebar (desktop)** / **Bottom card (mobile)**: `OrderSummary` com sticky positioning, atualizado em tempo real conforme cupom e parcelas.

Componente `StepIndicator`: círculos numerados 1-2-3 com labels "Dados", "Pagamento", "Revisão", conectados por linhas, step ativo em primary color.

O `CardCheckoutForm` atual (steps `personal` e `card`) será absorvido pelo wizard — os steps internos deixam de existir.

#### 2. Mover cupom para Etapa 3 (Revisão)

Atualmente o cupom está na página de seleção de planos (`CreditsCheckout.tsx`). No novo fluxo:
- **Remover** `CouponField` do `CreditsCheckout.tsx`
- **Adicionar** campo de cupom na Etapa 3 do wizard em `CreditsPayment.tsx`
- Passar `couponCode` no body da Edge Function junto com o pagamento
- Atualizar `OrderSummary` para exibir desconto aplicado

#### 3. Corrigir `activeSubs` no `CreditsCheckout.tsx`

Linha 216: incluir assinaturas canceladas com período vigente:
```typescript
const activeSubs = allSubs.filter(s => 
  ['ACTIVE', 'PENDING', 'OVERDUE'].includes(s.status) ||
  (s.status === 'CANCELLED' && s.next_due_date && new Date(s.next_due_date) > new Date())
);
```

Isso garante que o `highestActiveLevel` (usado para bloquear downgrades na aba Transfer, linha 825) e `getOverlappingSubs` (prorata) considerem corretamente planos cancelados mas ainda vigentes.

#### 4. Select (créditos avulsos) — mesmo wizard

Para compra de créditos avulsos via PIX: Etapa 1 pede só email → Etapa 2 mostra QR code.
Para compra via Cartão: Etapa 1 dados pessoais → Etapa 2 dados do cartão → Etapa 3 revisão.

### Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `src/pages/CreditsPayment.tsx` | Reescrever com wizard 3 etapas, step indicator, cupom na etapa 3, sidebar sticky |
| `src/pages/CreditsCheckout.tsx` | Corrigir `activeSubs` (linha 216). Remover `CouponField` dos cards. Passar sem cupom no state (cupom migra pro payment) |
| `src/hooks/useCouponValidation.ts` | Sem alteração (já pronto) |

### Regras mantidas

- Bloqueio de plano inferior/igual funciona via `getPlanHierarchyLevel` + `isSubActiveForPlan` (já considera cancelled vigente)
- Parcelamento: mínimo R$5/parcela, renovação automática (1x) vs manual (2-12x)
- Upgrade cross-product: prorata acumulado de múltiplas assinaturas
- Cycle upgrade: mensal→anual do mesmo plano

