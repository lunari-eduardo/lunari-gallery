
# Diagnóstico Completo: Fluxo de Pagamentos InfinitePay

## Problema Identificado

Após análise detalhada do código e banco de dados, identifiquei que **o problema NÃO está no código atual**, mas sim em **um problema de sincronização de deploy e ausência de webhook da InfinitePay**.

---

## Evidências Encontradas no Banco de Dados

### Cobranças Recentes InfinitePay:
```
1. gallery-1769478892567-ikjpcm
   - Status: pendente (deveria ser pago)
   - Valor: R$ 5,00
   - session_id: workflow-1769466628485-wdpyfqwulbe
   - data_pagamento: NULL
   - ip_transaction_nsu: NULL (webhook nunca recebido)

2. gallery-1769458954558-6lgnpm  
   - Status: pago (foi marcado manualmente com forceUpdate)
   - Valor: R$ 20,00
   - ip_transaction_nsu: test-123 (teste manual)
```

### Galerias Afetadas:
```
1. Galeria 3ca83599 (token: 0yddfZYIiTjY)
   - status_pagamento: pendente
   - valor_extras: R$ 5,00
   - sessao_valor_pago: 0 (nunca atualizado pelo webhook)

2. Galeria 73ab2d7e (token: FURuw2mxBjm5)
   - status_pagamento: aguardando_confirmacao
   - valor_extras: R$ 20,00
   - sessao_valor_pago: 120 (inclui valor anterior)
```

---

## Causa Raiz: InfinitePay NÃO Está Enviando Webhooks

### Verificação dos Logs:
- **infinitepay-webhook**: ZERO logs nos últimos dias
- **check-payment-status**: Funcionando corretamente
- **infinitepay-create-link**: Sem logs recentes

### Conclusão:
O webhook está corretamente configurado e funcional (testei manualmente), mas a InfinitePay **não está entregando as notificações de pagamento**. Possíveis razões:

1. **Webhook URL não registrada corretamente** na InfinitePay
2. **Problema de configuração** no painel InfinitePay
3. **Retry exhaustion**: tentativas anteriores (antes do verify_jwt=false) falharam e InfinitePay desistiu

---

## Ações Corretivas Necessárias

### 1. Verificação de Formato de Moeda (Centavos vs Reais)

**Arquivo**: `supabase/functions/infinitepay-create-link/index.ts`

O código atual está **CORRETO**:
```typescript
// Linha 99: Converte para centavos (InfinitePay espera centavos)
const valorCentavos = Math.round(valor * 100);
```

No entanto, o `normalizarValor()` em `pricingUtils.ts` pode estar causando problemas:
```typescript
// Se valor > 1000, divide por 100
// Isso pode causar normalização dupla em alguns casos
```

**Correção**: Adicionar validação explícita para evitar dupla normalização.

---

### 2. Melhorar Logs de Auditoria no Webhook

**Arquivo**: `supabase/functions/infinitepay-webhook/index.ts`

Adicionar tabela de log para rastrear todas as tentativas de webhook:

```typescript
// Inserir log de auditoria antes de processar
await supabase.from('webhook_logs').insert({
  provedor: 'infinitepay',
  payload: payload,
  headers: Object.fromEntries(req.headers),
  status: 'received',
  timestamp: new Date().toISOString()
});
```

---

### 3. Criar Tabela de Auditoria de Webhooks

Nova migração SQL:
```sql
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provedor TEXT NOT NULL,
  payload JSONB,
  headers JSONB,
  status TEXT DEFAULT 'received',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 4. Polling Automático como Fallback

**Arquivo**: `src/pages/GalleryDetail.tsx`

O botão "Verificar Status" já existe, mas podemos adicionar polling automático:

```typescript
// Polling a cada 30 segundos enquanto status = pendente
useEffect(() => {
  if (cobrancaData?.status === 'pendente' && cobrancaData?.provedor === 'infinitepay') {
    const interval = setInterval(async () => {
      await checkPaymentStatus();
    }, 30000);
    return () => clearInterval(interval);
  }
}, [cobrancaData]);
```

---

### 5. Forçar Deploy das Edge Functions

Garantir que todas as funções estejam com a versão mais recente:
- `infinitepay-create-link`
- `infinitepay-webhook`
- `confirm-selection`
- `check-payment-status`

---

### 6. Adicionar Redirect URL Robusta

**Arquivo**: `supabase/functions/infinitepay-create-link/index.ts`

Verificar se o redirect está sendo usado corretamente:
```typescript
// Já implementado, mas precisamos garantir que InfinitePay respeita
infinitePayload.redirect_url = `${baseUrl}/g/${galleryToken}?payment=success`;
```

---

## Arquivos a Modificar

| # | Arquivo | Tipo | Descrição |
|---|---------|------|-----------|
| 1 | `supabase/functions/infinitepay-webhook/index.ts` | Modificar | Adicionar log de auditoria em tabela |
| 2 | `supabase/functions/confirm-selection/index.ts` | Modificar | Adicionar logs mais detalhados |
| 3 | Nova migração SQL | Criar | Tabela webhook_logs para auditoria |
| 4 | `src/pages/GalleryDetail.tsx` | Modificar | Adicionar polling automático para pagamentos pendentes |
| 5 | `src/lib/pricingUtils.ts` | Modificar | Adicionar guard contra dupla normalização |

---

## Fluxo de Correção Robusto

```text
┌─────────────────────────────────────────────────────────────┐
│ FLUXO DE PAGAMENTO CORRIGIDO                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. confirm-selection                                       │
│     └─► Cria cobrança + LOG detalhado                       │
│                                                             │
│  2. infinitepay-create-link                                 │
│     ├─► Converte valor para centavos                        │
│     ├─► Envia webhook_url + redirect_url                    │
│     └─► LOG: payload enviado                                │
│                                                             │
│  3. Cliente paga no checkout InfinitePay                    │
│                                                             │
│  4a. WEBHOOK (se funcionar)                                 │
│      ├─► LOG em webhook_logs                                │
│      ├─► Atualiza cobrancas.status = 'pago'                 │
│      ├─► Atualiza galerias.status_pagamento = 'pago'        │
│      └─► Incrementa clientes_sessoes.valor_pago             │
│                                                             │
│  4b. POLLING (fallback automático)                          │
│      ├─► GalleryDetail verifica a cada 30s                  │
│      ├─► Chama check-payment-status                         │
│      └─► Atualiza UI se status mudou                        │
│                                                             │
│  5. MANUAL (último recurso)                                 │
│      └─► Fotógrafo clica "Confirmar Pago"                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Ação Imediata Recomendada

Para pagamentos já realizados que estão como "pendente", o fotógrafo pode usar o botão **"Confirmar Pago"** no painel de detalhes da galeria. Isso aciona o `check-payment-status` com `forceUpdate=true`, que:

1. Marca `cobrancas.status = 'pago'`
2. Atualiza `galerias.status_pagamento = 'pago'`
3. Incrementa `clientes_sessoes.valor_pago`

---

## Resumo das Modificações

1. **Tabela de auditoria** para webhooks (rastreabilidade)
2. **Polling automático** no frontend (fallback)
3. **Guard contra dupla normalização** de valores
4. **Re-deploy** de todas as edge functions
5. **Logs detalhados** em pontos críticos

Este plano garante que o sistema seja resiliente a falhas de webhook e escale para centenas de usuários com visibilidade total do fluxo de pagamentos.
