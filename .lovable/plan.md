
# Plano: Simplificação do Sistema de Créditos

## Problema Identificado

O sistema atual registra **1 entrada no `credit_ledger` por foto enviada**, o que é:
- **Ineficiente**: Milhões de registros por mês
- **Desnecessário**: Usuário não precisa ver log de cada foto
- **Custoso**: Impacta performance de queries e armazenamento

### Situação Atual
```text
credit_ledger (por CADA foto):
┌─────────────────────────────────────────────────┐
│ Upload: LISE2736.jpg  │ -1  │ 29/01/2026 13:21 │
│ Upload: LISE2740.jpg  │ -1  │ 29/01/2026 13:21 │
│ Upload: LISE2739.jpg  │ -1  │ 29/01/2026 13:21 │
│ Compra via MP         │ +2000 │ 29/01/2026 13:16 │
└─────────────────────────────────────────────────┘
```

---

## Solução Proposta

### Modelo Simplificado

**Manter no `photographer_accounts`:**
| Campo | Descrição |
|-------|-----------|
| `photo_credits` | Saldo atual disponível |
| `credits_purchased_total` | Total comprado (histórico acumulado) |
| `credits_consumed_total` | Total consumido (histórico acumulado) |
| `updated_at` | Última atualização |

**Manter no `credit_ledger` APENAS:**
- Compras (`purchase`)
- Bônus administrativos (`bonus`)
- Ajustes/estornos excepcionais (`adjustment`, `refund`)

**ELIMINAR do `credit_ledger`:**
- ❌ Registros de upload (`upload`)
- ❌ Referências a `photo_id`

---

## Arquivos a Modificar

### 1. Banco de Dados (Migration)

**Adicionar colunas agregadas em `photographer_accounts`:**
```sql
ALTER TABLE photographer_accounts
ADD COLUMN IF NOT EXISTS credits_purchased_total INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS credits_consumed_total INTEGER DEFAULT 0;
```

**Modificar RPC `consume_photo_credits`:**
- Continua deduzindo de `photo_credits`
- Incrementa `credits_consumed_total`
- NÃO registra no `credit_ledger`

**Remover RPC `record_photo_credit_usage`:**
- Não será mais necessária

### 2. Edge Function `b2-upload/index.ts`

**Remover linhas 433-445:**
```typescript
// REMOVER: Record credit usage in ledger
if (!isAdmin) {
  supabase.rpc('record_photo_credit_usage', { ... });
}
```

### 3. Hook `usePhotoCredits.ts`

**Remover completamente:**
- Query de histórico (`credit-history`)
- Interface `CreditLedgerEntry`
- Retornos `history`, `isLoadingHistory`

**Simplificar para:**
```typescript
return {
  photoCredits,
  isAdmin,
  isLoading,
  canUpload,
  refetch,
};
```

### 4. Página `Credits.tsx`

**Remover seção "Histórico de Uso" (linhas 173-208):**
- Eliminar todo o bloco que exibe histórico por foto
- Manter apenas: Saldo + Pacotes + Histórico de Compras

---

## Estrutura Final da Página de Créditos

```text
┌────────────────────────────────────────────┐
│  💳 Seu Saldo                              │
│  ┌──────────────────────────────────────┐  │
│  │        1.997 créditos               │  │
│  │     créditos disponíveis            │  │
│  └──────────────────────────────────────┘  │
├────────────────────────────────────────────┤
│  🛒 Comprar Créditos                       │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐              │
│  │2k  │ │5k  │ │10k │ │20k │              │
│  │R$19│ │R$39│ │R$69│ │R$99│              │
│  └────┘ └────┘ └────┘ └────┘              │
├────────────────────────────────────────────┤
│  📜 Histórico de Compras                   │
│  ┌──────────────────────────────────────┐  │
│  │ 2.000 créditos  │ R$ 19,00  │ Pago   │  │
│  │ 29 de jan às 13:15                   │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

**Removido:** Seção "Histórico de Uso" com log por foto

---

## Resumo de Alterações

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/*.sql` | Nova migration: adicionar colunas agregadas, modificar RPC |
| `supabase/functions/b2-upload/index.ts` | Remover chamada `record_photo_credit_usage` |
| `src/hooks/usePhotoCredits.ts` | Remover query de histórico e exports relacionados |
| `src/pages/Credits.tsx` | Remover seção "Histórico de Uso" |

---

## Benefícios

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Registros/mês (1M fotos) | ~1.000.000 | ~100 (só compras) |
| Tamanho do ledger | Cresce exponencialmente | Estável |
| Query de saldo | Precisa somar ledger | Campo direto |
| Complexidade | Alta | Baixa |

---

## Considerações

1. **Dados existentes**: Os registros `upload` no `credit_ledger` podem ser mantidos ou deletados (baixo volume atual)

2. **Auditoria**: Se precisar auditar consumo, usar `galerias.total_fotos` (já existe) - cada galeria sabe quantas fotos tem

3. **Histórico de compras**: Continua em `credit_purchases` (já implementado, separado do ledger)
