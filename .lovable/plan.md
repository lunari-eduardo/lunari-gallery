# Plano: Simplificação do Sistema de Créditos

## ✅ IMPLEMENTADO

### Mudanças Realizadas

1. **Banco de Dados**
   - Adicionadas colunas `credits_purchased_total` e `credits_consumed_total` em `photographer_accounts`
   - Modificada RPC `consume_photo_credits` para incrementar contador agregado sem criar entradas no ledger
   - Removida RPC `record_photo_credit_usage` (não mais necessária)
   - Limpas entradas antigas de `upload` do `credit_ledger`

2. **Edge Function `b2-upload/index.ts`**
   - Removida chamada a `record_photo_credit_usage`
   - Créditos agora são consumidos atomicamente via RPC com contador agregado

3. **Hook `usePhotoCredits.ts`**
   - Removida query de histórico (`credit-history`)
   - Removida interface `CreditLedgerEntry`
   - Simplificado retorno: apenas `photoCredits`, `isAdmin`, `isLoading`, `canUpload`, `refetch`

4. **Página `Credits.tsx`**
   - Removida seção "Histórico de Uso" (log por foto)
   - Mantido: Saldo + Pacotes + Histórico de Compras

---

## Estrutura Final

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

---

## Benefícios Alcançados

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Registros/mês (1M fotos) | ~1.000.000 | ~100 (só compras) |
| Tamanho do ledger | Cresce exponencialmente | Estável |
| Query de saldo | Campo direto | Campo direto |
| Complexidade | Alta | Baixa |

---

## Auditoria de Consumo

Se necessário auditar consumo:
- `photographer_accounts.credits_consumed_total` - total agregado por usuário
- `galerias.total_fotos` - contagem por galeria (já existe)
