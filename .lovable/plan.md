

## Redesign da página Gerenciar Assinaturas

### Objetivo
Alinhar o visual com a página de Configurações (padrão `lunari-card`) e unificar o aviso de cancelamento **dentro** do card do plano.

### Mudanças em `src/pages/SubscriptionManagement.tsx`

**1. Estrutura do SubscriptionCard — unificar tudo em um único `lunari-card`**

Cada assinatura será um único card contendo:
- Header: ícone + nome do plano + badge de status
- Grid de detalhes (valor, próxima cobrança, assinante desde)
- Se cancelada mas ainda ativa: banner amber **dentro** do card com botão "Desfazer cancelamento"
- Se há downgrade pendente: banner amber **dentro** do card
- Ações (Upgrade/Downgrade + Cancelar) **dentro** do card, separadas por `Separator`

**2. Estilo visual**
- Trocar `rounded-xl border bg-card` por classe `lunari-card`
- Usar padrão icon+title do Settings (div 10x10 rounded-lg bg-primary/10 + ícone)
- Remover cards separados para aviso de cancelamento, downgrade e ações
- Separar seções internas com `border-t` ou `Separator`

**3. Layout do card unificado:**
```text
┌─────────────────────────────────────────────┐
│ [icon] Plano Atual                  [Badge] │
│         Transfer 5 GB                       │
│         Plano mensal                        │
│─────────────────────────────────────────────│
│ 💳 Valor    📅 Próx. cobrança   📅 Desde   │
│─────────────────────────────────────────────│
│ ⚠️ Assinatura cancelada — ativo até X      │  ← só se cancelada
│    [Desfazer cancelamento]                  │
│─────────────────────────────────────────────│
│ ⚠️ Downgrade agendado para Y  [Cancelar]   │  ← só se pendente
│─────────────────────────────────────────────│
│ [Upgrade/Downgrade]  [Cancelar assinatura]  │  ← só se ativa
│ Alterações proporcionais ao período atual.  │
└─────────────────────────────────────────────┘
```

### Arquivo impactado
- `src/pages/SubscriptionManagement.tsx` — rewrite do `SubscriptionCard`

