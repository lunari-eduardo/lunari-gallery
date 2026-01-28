
# Plano: Correção Completa do Sistema de Crédito para Fotos Extras

## Problema Identificado

O cálculo de precificação progressiva na tela do cliente (`SelectionConfirmation`) está mostrando **R$ 9,00** quando deveria mostrar **R$ 4,00**.

### Análise da Imagem

| Campo | Valor na Tela |
|-------|---------------|
| Fotos incluídas no pacote | 1 |
| Fotos extras já pagas | +1 |
| Fotos selecionadas | 4 |
| Fotos extras a cobrar | 2 |
| Valor por foto | R$ 3,00 |
| **Valor Adicional (ERRADO)** | R$ 9,00 |

### Cálculo Correto

```text
Total de extras = 4 - 1 = 3 fotos extras
Extras já pagas = 1
Extras a cobrar = 3 - 1 = 2 ✅

Valor já pago (1 foto na faixa 1-2) = R$ 5,00
Faixa atual (3 extras) = R$ 3,00/foto
Valor total ideal = 3 × R$ 3,00 = R$ 9,00
Valor a cobrar = R$ 9,00 - R$ 5,00 = R$ 4,00 ✅
```

**O problema é que `valorJaPago` está chegando como `0` no frontend**, fazendo com que o cálculo seja:
- `R$ 9,00 - R$ 0,00 = R$ 9,00` ❌

---

## Causa Raiz: `valor_total_vendido` Não Está na Resposta da Edge Function

### Edge Function `gallery-access` (Linha 165)

```typescript
// ATUAL - Faltando valor_total_vendido!
{
  extrasPagasTotal: gallery.total_fotos_extras_vendidas || 0,
  // ❌ FALTA: valorTotalVendido: gallery.valor_total_vendido || 0,
}
```

A Edge Function busca `total_fotos_extras_vendidas` e retorna como `extrasPagasTotal`, mas **não retorna** `valor_total_vendido`. 

### Frontend `ClientGallery.tsx` (Linha 689)

```typescript
// ATUAL - Procura propriedade que não existe!
const valorJaPago = supabaseGallery?.valor_total_vendido || 0;
// Resultado: valorJaPago = 0 sempre!
```

O frontend procura por `valor_total_vendido` que não foi enviado pela Edge Function.

---

## Problemas Encontrados (3 no total)

### Problema 1: Edge Function `gallery-access` não retorna `valor_total_vendido`

| Arquivo | Linha | Problema |
|---------|-------|----------|
| `supabase/functions/gallery-access/index.ts` | 165 | Falta `valorTotalVendido` na resposta |

### Problema 2: Frontend procura campo com nome errado

| Arquivo | Linha | Problema |
|---------|-------|----------|
| `src/pages/ClientGallery.tsx` | 689 | Procura `valor_total_vendido` (snake_case) mas Edge Function usa camelCase |

### Problema 3: `SelectionSummary` (bottom-bar variant) não usa lógica de crédito

| Arquivo | Linha | Problema |
|---------|-------|----------|
| `src/components/SelectionSummary.tsx` | 51-96 | Variant `bottom-bar` mostra `extraCount` em vez de `totalExtras` para contagem |

---

## Solução Proposta

### Correção 1: Adicionar `valorTotalVendido` na Edge Function `gallery-access`

```typescript
// supabase/functions/gallery-access/index.ts - Linha 165
{
  // ... existente
  extrasPagasTotal: gallery.total_fotos_extras_vendidas || 0,
  // NOVO: Incluir valor já pago
  valorTotalVendido: gallery.valor_total_vendido || 0,
}
```

### Correção 2: Frontend usar nome correto do campo

```typescript
// src/pages/ClientGallery.tsx - Linha 689
// ANTES:
const valorJaPago = supabaseGallery?.valor_total_vendido || 0;

// DEPOIS:
const valorJaPago = supabaseGallery?.valorTotalVendido || supabaseGallery?.valor_total_vendido || 0;
```

### Correção 3: SelectionSummary bottom-bar mostrar contagem correta

```typescript
// src/components/SelectionSummary.tsx - Linha 64
// ANTES:
<span className="text-sm font-medium">+{extraCount} extras</span>

// DEPOIS:
<span className="text-sm font-medium">+{totalExtras} extras</span>
```

---

## Arquivos a Modificar

| # | Arquivo | Alteração |
|---|---------|-----------|
| 1 | `supabase/functions/gallery-access/index.ts` | Adicionar `valorTotalVendido` na resposta |
| 2 | `src/pages/ClientGallery.tsx` | Usar `valorTotalVendido` (camelCase) |
| 3 | `src/components/SelectionSummary.tsx` | Corrigir bottom-bar para usar `totalExtras` |

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────────┐
│ CENÁRIO: 1 foto paga (R$ 5), cliente seleciona +2 = 3 extras totais │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ 1. Edge Function gallery-access:                                    │
│    ├── Busca: gallery.total_fotos_extras_vendidas = 1               │
│    ├── Busca: gallery.valor_total_vendido = 5                       │
│    └── Retorna: { extrasPagasTotal: 1, valorTotalVendido: 5 }  ✅   │
│                                                                     │
│ 2. Frontend ClientGallery.tsx:                                      │
│    ├── extrasPagasTotal = supabaseGallery.extrasPagasTotal = 1      │
│    ├── valorJaPago = supabaseGallery.valorTotalVendido = 5  ✅      │
│    └── Passa para SelectionConfirmation                             │
│                                                                     │
│ 3. SelectionConfirmation.tsx:                                       │
│    ├── extrasACobrar = 2 (novas)                                    │
│    ├── extrasPagasAnteriormente = 1                                 │
│    ├── valorJaPago = 5                                              │
│    ├── totalExtras = 1 + 2 = 3                                      │
│    ├── valorUnitario (faixa 3) = R$ 3,00                            │
│    ├── valorTotalIdeal = 3 × R$ 3,00 = R$ 9,00                      │
│    ├── valorACobrar = R$ 9,00 - R$ 5,00 = R$ 4,00  ✅               │
│    └── Exibe: "Valor Adicional: R$ 4,00"                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Verificação de Consistência

Após as correções, os valores exibidos serão:

| Campo | Valor |
|-------|-------|
| Fotos incluídas no pacote | 1 |
| Fotos extras já pagas | +1 |
| Fotos selecionadas | 4 |
| Fotos extras a cobrar | 2 |
| Valor por foto | R$ 3,00 |
| **Valor total (3 fotos)** | R$ 9,00 |
| **Já pago anteriormente** | -R$ 5,00 |
| **Valor Adicional (CORRETO)** | **R$ 4,00** ✅ |

---

## Resumo das Alterações

1. **Edge Function `gallery-access`**: Adicionar `valorTotalVendido: gallery.valor_total_vendido || 0`
2. **ClientGallery.tsx**: Usar `valorTotalVendido` (camelCase) para pegar valor da resposta
3. **SelectionSummary.tsx**: Ajustar bottom-bar para exibir `totalExtras` corretamente

---

## Impacto

- **Modo PIX Manual**: Corrigido
- **Modo InfinitePay**: Corrigido  
- **Modo MercadoPago**: Corrigido
- **Modo Sem Venda**: Não afetado (não cobra extras)
- **Modo Cobrança Posterior**: Corrigido (exibe valor correto)

Todas as formas de pagamento usarão o sistema de crédito corretamente após as alterações.
