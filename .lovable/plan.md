

# Plano de Adequação: Lógica de Seleção e Cobrança de Fotos Extras

## Diagnóstico da Implementação Atual

### ✅ O que JÁ existe e funciona

| Campo | Tabela | Uso Atual |
|-------|--------|-----------|
| `fotos_incluidas` | galerias | Fotos inclusas no pacote |
| `valor_foto_extra` | galerias | Preço por foto extra |
| `total_fotos_extras_vendidas` | galerias | **Existe mas NÃO é usado corretamente** |
| `valor_total_vendido` | galerias | Valor acumulado de vendas |
| `valor_pago` | clientes_sessoes | Valor financeiro pago |

### ❌ Problemas Identificados

| # | Problema | Localização | Impacto |
|---|----------|-------------|---------|
| 1 | `total_fotos_extras_vendidas` existe mas **nunca é incrementado** | confirm-selection, webhooks | Pagamentos duplicados |
| 2 | Cálculo de extras não desconta `extras_pagas_total` | confirm-selection L182 | Cliente paga 2x pela mesma quantidade |
| 3 | Reativação não considera extras já pagas | useSupabaseGalleries | Cobrança incorreta |
| 4 | UI não mostra extras já pagas anteriormente | SelectionConfirmation | UX confusa |
| 5 | Webhook só incrementa valor (R$), não quantidade | infinitepay-webhook | Descompasso |

### Fórmula Atual (INCORRETA)

```typescript
// L182 - confirm-selection/index.ts
const extrasCount = Math.max(0, selectedCount - gallery.fotos_incluidas);
// PROBLEMA: Não subtrai extras já pagas!
```

### Fórmula Correta (Regra de Produto)

```typescript
extras_necessarias = total_fotos_selecionadas - fotos_inclusas_no_pacote
extras_a_cobrar = Math.max(0, extras_necessarias - extras_pagas_total)
```

---

## Alterações Necessárias

### 1. Edge Function `confirm-selection/index.ts`

**Objetivo**: Implementar fórmula correta de cobrança

**Alterações**:

1. Buscar `total_fotos_extras_vendidas` da galeria (L159)
2. Calcular `extras_a_cobrar` corretamente (L182)
3. Não impedir seleção se `extras_a_cobrar = 0` (mesmo com extras > inclusas)

```typescript
// Buscar (já existe na query L157-160, só adicionar campo)
.select('id, status, ..., total_fotos_extras_vendidas')

// Calcular (L182)
const extrasNecessarias = Math.max(0, (selectedCount || 0) - (gallery.fotos_incluidas || 0));
const extrasPagasTotal = gallery.total_fotos_extras_vendidas || 0;
const extrasACobrar = Math.max(0, extrasNecessarias - extrasPagasTotal);

// Usar extrasACobrar para cobrança, mas salvar extrasNecessarias para controle
```

---

### 2. Edge Function `infinitepay-webhook/index.ts`

**Objetivo**: Incrementar quantidade de extras pagas ao confirmar pagamento

**Alterações**:

1. Buscar `qtd_fotos_extra` da cobrança (precisa salvar na criação)
2. Incrementar `total_fotos_extras_vendidas` na galeria

```typescript
// Após confirmar pagamento (L275+)
if (cobranca.galeria_id) {
  const { data: galeria } = await supabase
    .from('galerias')
    .select('total_fotos_extras_vendidas')
    .eq('id', cobranca.galeria_id)
    .maybeSingle();

  if (galeria) {
    const extrasAtuais = galeria.total_fotos_extras_vendidas || 0;
    const extrasNovas = cobranca.qtd_fotos || 0; // Precisa salvar na criação
    
    await supabase
      .from('galerias')
      .update({ 
        total_fotos_extras_vendidas: extrasAtuais + extrasNovas,
        valor_total_vendido: (galeria.valor_total_vendido || 0) + cobranca.valor
      })
      .eq('id', cobranca.galeria_id);
  }
}
```

---

### 3. Edge Function `check-payment-status/index.ts`

**Objetivo**: Mesma lógica do webhook para verificação manual

**Alterações**: Replicar incremento de `total_fotos_extras_vendidas`

---

### 4. Tabela `cobrancas` - Novo campo

**Objetivo**: Rastrear quantidade de fotos da cobrança

**Migração**:

```sql
ALTER TABLE cobrancas 
ADD COLUMN IF NOT EXISTS qtd_fotos integer DEFAULT 0;

COMMENT ON COLUMN cobrancas.qtd_fotos IS 'Quantidade de fotos extras cobradas nesta transação';
```

---

### 5. Edge Function `infinitepay-create-link/index.ts`

**Objetivo**: Salvar quantidade de fotos na cobrança

**Alteração**: Adicionar `qtd_fotos` ao criar cobrança

```typescript
// Ao criar cobrança
.insert({
  ...dadosExistentes,
  qtd_fotos: body.qtdFotos || 0, // Novo parâmetro
})
```

---

### 6. Edge Function `confirm-selection/index.ts` - Chamada de pagamento

**Objetivo**: Passar quantidade de fotos para criação de link

**Alteração**:

```typescript
// L301-310
const { data: paymentData, error: paymentError } = await supabase.functions.invoke(functionName, {
  body: {
    ...dadosExistentes,
    qtdFotos: extrasACobrar, // NOVO: quantidade a cobrar
  }
});
```

---

### 7. Componente `SelectionConfirmation.tsx`

**Objetivo**: Mostrar extras já pagas na UI

**Props adicionais**:

```typescript
interface SelectionConfirmationProps {
  // ... existentes
  extrasPagasAnteriormente?: number; // NOVO
}
```

**UI atualizada**:

```typescript
{/* Photo Breakdown */}
<div className="p-4 border-b border-border/50 space-y-3">
  <div className="flex justify-between text-sm">
    <span className="text-muted-foreground">Fotos incluídas no pacote</span>
    <span className="font-medium">{gallery.includedPhotos}</span>
  </div>
  
  {/* NOVO: Extras já pagas */}
  {extrasPagasAnteriormente > 0 && (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">Fotos extras já pagas</span>
      <span className="font-medium text-green-600">+{extrasPagasAnteriormente}</span>
    </div>
  )}
  
  <div className="flex justify-between text-sm">
    <span className="text-muted-foreground">Fotos selecionadas</span>
    <span className="font-medium">{selectedCount}</span>
  </div>
  
  {/* Extras a cobrar (não mais extraCount simples) */}
  {extrasACobrar > 0 && (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">Fotos extras a cobrar</span>
      <span className="font-medium text-primary">{extrasACobrar}</span>
    </div>
  )}
</div>
```

---

### 8. Componente `ClientGallery.tsx`

**Objetivo**: Calcular `extrasACobrar` corretamente

**Alterações**:

1. Buscar `total_fotos_extras_vendidas` do supabaseGallery
2. Calcular `extrasACobrar` com fórmula correta
3. Passar para `SelectionConfirmation`

```typescript
// L676-677 - Cálculo atual
const selectedCount = localPhotos.filter(p => p.isSelected).length;
const extrasNecessarias = Math.max(0, selectedCount - gallery.includedPhotos);

// NOVO: Considerar extras já pagas
const extrasPagasTotal = supabaseGallery?.total_fotos_extras_vendidas || 0;
const extrasACobrar = Math.max(0, extrasNecessarias - extrasPagasTotal);

// Usar extrasACobrar para cálculo de preço
const { valorUnitario, valorTotal: extraTotal } = calcularPrecoProgressivo(
  extrasACobrar, // Agora é extrasACobrar, não extraCount
  regrasCongeladas,
  gallery.extraPhotoPrice
);
```

---

### 9. Hook `useSupabaseGalleries.ts` - Reativação

**Objetivo**: Não zerar `total_fotos_extras_vendidas` ao reativar

**Verificação**: Confirmar que `reopenSelectionMutation` NÃO reseta esse campo.

```typescript
// L523-533 - Verificar que NÃO inclui:
// total_fotos_extras_vendidas: 0  ← NÃO FAZER ISSO
```

---

### 10. Edge Function `gallery-access/index.ts`

**Objetivo**: Retornar `total_fotos_extras_vendidas` para o cliente

**Alteração**: Incluir na resposta

```typescript
// Na resposta
return {
  ...dadosExistentes,
  extrasPagasTotal: galeria.total_fotos_extras_vendidas || 0,
}
```

---

## Fluxo de Cobrança Corrigido

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ FLUXO DE SELEÇÃO E COBRANÇA (Corrigido)                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  DADOS FIXOS DA GALERIA:                                                │
│  ├── fotos_incluidas = 10                                               │
│  ├── valor_foto_extra = R$ 25,00                                        │
│  └── total_fotos_extras_vendidas = 0 (inicialmente)                     │
│                                                                         │
│  CICLO 1: Primeira Seleção                                              │
│  ├── Cliente seleciona 15 fotos                                         │
│  ├── extras_necessarias = 15 - 10 = 5                                   │
│  ├── extras_a_cobrar = max(5 - 0, 0) = 5                                │
│  ├── Valor cobrado = 5 × R$ 25 = R$ 125                                 │
│  └── Após pagamento: total_fotos_extras_vendidas = 5                    │
│                                                                         │
│  CICLO 2: Reativação pelo Fotógrafo                                     │
│  ├── Cliente pode trocar QUALQUER foto livremente                       │
│  ├── total_fotos_extras_vendidas = 5 (mantido)                          │
│  └── Seleção anterior não é "carrinho" bloqueado                        │
│                                                                         │
│  CENÁRIO 2A: Cliente seleciona 13 fotos (menos que antes)               │
│  ├── extras_necessarias = 13 - 10 = 3                                   │
│  ├── extras_a_cobrar = max(3 - 5, 0) = 0 ← JÁ TEM CRÉDITO               │
│  └── Valor cobrado = R$ 0                                               │
│                                                                         │
│  CENÁRIO 2B: Cliente seleciona 18 fotos (mais que antes)                │
│  ├── extras_necessarias = 18 - 10 = 8                                   │
│  ├── extras_a_cobrar = max(8 - 5, 0) = 3 ← SÓ COBRA DIFERENÇA           │
│  ├── Valor cobrado = 3 × R$ 25 = R$ 75                                  │
│  └── Após pagamento: total_fotos_extras_vendidas = 8                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| # | Arquivo | Alteração | Prioridade |
|---|---------|-----------|------------|
| 1 | `supabase/functions/confirm-selection/index.ts` | Fórmula correta + passar qtdFotos | Alta |
| 2 | `supabase/functions/infinitepay-webhook/index.ts` | Incrementar total_fotos_extras_vendidas | Alta |
| 3 | `supabase/functions/check-payment-status/index.ts` | Mesma lógica do webhook | Alta |
| 4 | `supabase/functions/infinitepay-create-link/index.ts` | Salvar qtd_fotos | Alta |
| 5 | `supabase/functions/gallery-access/index.ts` | Retornar extrasPagasTotal | Média |
| 6 | `src/pages/ClientGallery.tsx` | Calcular extrasACobrar | Média |
| 7 | `src/components/SelectionConfirmation.tsx` | Exibir extras já pagas | Média |
| 8 | **Migração SQL** | Adicionar coluna qtd_fotos em cobrancas | Alta |

---

## Migração de Banco de Dados

```sql
-- Adicionar campo para rastrear quantidade de fotos por cobrança
ALTER TABLE cobrancas 
ADD COLUMN IF NOT EXISTS qtd_fotos integer DEFAULT 0;

-- Adicionar campo para vincular cobrança à galeria
ALTER TABLE cobrancas 
ADD COLUMN IF NOT EXISTS galeria_id uuid REFERENCES galerias(id);

-- Comentários para documentação
COMMENT ON COLUMN cobrancas.qtd_fotos IS 'Quantidade de fotos extras cobradas nesta transação';
COMMENT ON COLUMN cobrancas.galeria_id IS 'Galeria associada a esta cobrança (se aplicável)';
```

---

## Validações Pós-Implementação

| # | Cenário de Teste | Resultado Esperado |
|---|------------------|-------------------|
| 1 | Primeira seleção com 5 extras | Cobrar R$ 125 (5 × R$ 25) |
| 2 | Após pagamento, verificar total_fotos_extras_vendidas | Deve ser 5 |
| 3 | Reativar e selecionar 3 extras | Cobrar R$ 0 (já pagou 5) |
| 4 | Reativar e selecionar 8 extras | Cobrar R$ 75 (3 novas × R$ 25) |
| 5 | UI mostra "5 extras já pagas" | Visível no checkout |
| 6 | Trocar fotos livremente na reativação | Permitido sem bloqueio |

---

## Garantias Finais

| Regra de Produto | Implementação |
|------------------|---------------|
| Cliente nunca paga 2x pela mesma quantidade | `extrasACobrar = max(necessarias - pagas, 0)` |
| Fotógrafo tem controle previsível | `total_fotos_extras_vendidas` sempre incrementa |
| Sistema escalável | Funciona com N reativações |
| Lógica independente de foto específica | Baseado em quantidade, não em IDs |

