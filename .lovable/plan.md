
# Plano de Correção: Histórico de Pagamentos na Galeria

## Diagnóstico

### Problema Identificado

A galeria mostra apenas o **último pagamento** em vez de todo o histórico de transações.

| Dado | Banco de Dados | Tela Atual |
|------|----------------|------------|
| Pagamentos realizados | 2 (R$ 5 + R$ 5) | Apenas 1 (R$ 5) |
| Valor total pago | R$ 10 | R$ 5 |
| Comprovantes | 2 links | 1 link |

### Causa Raiz

```typescript
// GalleryDetail.tsx L86-88
.order('created_at', { ascending: false })
.limit(1)  // ← PROBLEMA: Só busca o último
.maybeSingle();
```

### Dados Corretos no Banco

A tabela `galerias` já possui os campos corretos:
- `total_fotos_extras_vendidas: 2` ✅
- `valor_total_vendido: 10` ✅

A tabela `cobrancas` tem todos os registros:
- `da8daab8...` - R$ 5.00, 1 foto, pago 19:24
- `a271b642...` - R$ 5.00, 1 foto, pago 19:46

---

## Solução Proposta

### 1. Buscar TODOS os pagamentos (não apenas o último)

**Arquivo**: `src/pages/GalleryDetail.tsx`

Alterar a query para buscar todos os pagamentos da galeria/sessão:

```typescript
const { data: cobrancasData, refetch: refetchCobrancas } = useQuery({
  queryKey: ['galeria-cobrancas', id],
  queryFn: async () => {
    // Buscar por galeria_id OU session_id
    const queries = [];
    
    if (supabaseGallery?.id) {
      queries.push(
        supabase
          .from('cobrancas')
          .select('*')
          .eq('galeria_id', supabaseGallery.id)
          .eq('status', 'pago')
          .order('created_at', { ascending: false })
      );
    }
    
    if (supabaseGallery?.sessionId) {
      queries.push(
        supabase
          .from('cobrancas')
          .select('*')
          .eq('session_id', supabaseGallery.sessionId)
          .eq('status', 'pago')
          .order('created_at', { ascending: false })
      );
    }
    
    // Combinar e deduplicar resultados
    // ...
    return cobrancasPagas;
  },
  enabled: !!supabaseGallery,
});
```

### 2. Criar componente de Histórico de Pagamentos

**Novo arquivo**: `src/components/PaymentHistoryCard.tsx`

Exibir lista de pagamentos com:
- Total acumulado no topo
- Lista de transações individuais
- Link para comprovante de cada uma

```
┌────────────────────────────────────────────┐
│ 💳 Histórico de Pagamentos                 │
├────────────────────────────────────────────┤
│ Total pago                      R$ 10.00   │
│ Transações                            2    │
├────────────────────────────────────────────┤
│                                            │
│ ┌────────────────────────────────────────┐ │
│ │ 27/01/2026 às 19:46                    │ │
│ │ 1 foto extra • R$ 5.00                 │ │
│ │ InfinitePay • [Ver comprovante]        │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ ┌────────────────────────────────────────┐ │
│ │ 27/01/2026 às 19:24                    │ │
│ │ 1 foto extra • R$ 5.00                 │ │
│ │ InfinitePay • [Ver comprovante]        │ │
│ └────────────────────────────────────────┘ │
│                                            │
└────────────────────────────────────────────┘
```

### 3. Atualizar GalleryDetail para usar dados agregados

**Arquivo**: `src/pages/GalleryDetail.tsx`

- Usar `valor_total_vendido` da galeria para exibir valor pago total
- Renderizar `PaymentHistoryCard` com lista de cobrancas
- Manter `PaymentStatusCard` para status atual e ações

### 4. Ajustar valorPago no PaymentStatusCard

O `valorPago` deve vir de `galerias.valor_total_vendido` (fonte da verdade), não da última cobrança:

```typescript
<PaymentStatusCard
  ...
  valorPago={supabaseGallery.valorTotalVendido || 0}  // Usar campo correto
  ...
/>
```

---

## Arquivos a Modificar/Criar

| # | Arquivo | Alteração |
|---|---------|-----------|
| 1 | `src/components/PaymentHistoryCard.tsx` | **CRIAR**: Componente de histórico |
| 2 | `src/pages/GalleryDetail.tsx` | Buscar todas cobrancas, usar valor_total_vendido |
| 3 | `src/hooks/useSupabaseGalleries.ts` | Garantir que `valorTotalVendido` está no tipo |

---

## Detalhes Técnicos

### Interface do novo componente

```typescript
interface PaymentHistoryCardProps {
  cobrancas: Array<{
    id: string;
    valor: number;
    qtd_fotos: number;
    provedor: string;
    data_pagamento: string;
    ip_receipt_url?: string;
  }>;
  valorTotalPago: number;
}
```

### Query atualizada em GalleryDetail

```typescript
// Buscar TODAS as cobrancas pagas desta galeria
const { data: cobrancasPagas = [] } = useQuery({
  queryKey: ['galeria-cobrancas-pagas', id],
  queryFn: async () => {
    const { data } = await supabase
      .from('cobrancas')
      .select('id, valor, qtd_fotos, provedor, data_pagamento, ip_receipt_url, created_at')
      .or(`galeria_id.eq.${id},session_id.eq.${supabaseGallery?.sessionId}`)
      .eq('status', 'pago')
      .order('created_at', { ascending: false });
    return data || [];
  },
  enabled: !!supabaseGallery,
});
```

### Uso no template

```tsx
{/* Na aba Seleção ou Detalhes */}
{cobrancasPagas.length > 0 && (
  <PaymentHistoryCard
    cobrancas={cobrancasPagas}
    valorTotalPago={supabaseGallery.valorTotalVendido}
  />
)}
```

---

## Comportamento Final Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| 1º pagamento | Mostra 1 transação | Mostra 1 transação |
| 2º pagamento (após reativação) | Sobrescreve, mostra só a última | Lista 2 transações |
| Valor pago | R$ 5 (última) | R$ 10 (soma total) |
| Comprovantes | 1 link | 2 links (um por transação) |

---

## Resumo da Seção de Pagamentos (Nova UI)

### Aba "Seleção"
- **Resumo da Seleção** (existente)
- **Status do Pagamento** (simplificado - status atual + ações)

### Aba "Detalhes"  
- **Histórico de Pagamentos** (NOVO)
  - Total pago (soma de todas cobrancas)
  - Lista de transações com data, valor, provedor e comprovante
