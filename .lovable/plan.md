

# Plano de Execução: Adequação ao Contrato Oficial InfinitePay

## Resumo

Implementar as correções obrigatórias nas Edge Functions para cumprir 100% do Contrato Oficial de Cobranças InfinitePay.

---

## Alterações Detalhadas

### 1. `infinitepay-webhook/index.ts` - LOG IMEDIATO (Regra 3.1.2)

**Problema Atual (L56-80):** O log só acontece após o parsing do JSON. Se o parsing falhar, o payload bruto pode ser perdido antes do registro.

**Correção:** Mover o log para IMEDIATAMENTE após ler o body, ANTES de qualquer processamento.

```text
ANTES:
  L57: rawBody = await req.text();
  L62-80: try { parse } catch { log erro }
  L88-94: log com payload parseado

DEPOIS:
  L57: rawBody = await req.text();
  L58: LOG IMEDIATO (payload bruto + headers)
  L63+: try { parse + atualiza log } catch { atualiza log para erro }
```

---

### 2. `infinitepay-webhook/index.ts` - ORDEM DE BUSCA (Regra 3.1.4)

**Problema Atual (L120-125):** Busca apenas por `ip_order_nsu`, não faz fallback para `id`.

**Correção:** Implementar busca em duas etapas conforme contrato:
1. Buscar por `ip_order_nsu = order_nsu`
2. Se não encontrar, buscar por `id = order_nsu` (fallback UUID)

```text
ANTES (L120-125):
  const { data: cobranca } = await supabase
    .from('cobrancas')
    .eq('ip_order_nsu', orderNsu)
    .maybeSingle();

DEPOIS:
  // PASSO 1: Buscar por ip_order_nsu
  let cobranca = null;
  const { data: cobrancaByNsu } = await supabase
    .from('cobrancas')
    .eq('ip_order_nsu', orderNsu)
    .maybeSingle();
  
  cobranca = cobrancaByNsu;
  
  // PASSO 2: Fallback por id (UUID)
  if (!cobranca) {
    const { data: cobrancaById } = await supabase
      .from('cobrancas')
      .eq('id', orderNsu)
      .maybeSingle();
    cobranca = cobrancaById;
  }
```

---

### 3. `check-payment-status/index.ts` - ORDEM DE BUSCA (Regra 3.1.4)

**Problema Atual (L91-92):** Quando recebe `orderNsu`, busca apenas por `ip_order_nsu`.

**Correção:** Aplicar mesma lógica de busca dupla do webhook.

```text
ANTES (L91-92):
  } else if (orderNsu) {
    query = query.eq('ip_order_nsu', orderNsu);
  }

DEPOIS:
  } else if (orderNsu) {
    // Busca primária por ip_order_nsu
    const { data: cobrancaByNsu } = await supabase
      .from('cobrancas')
      .eq('ip_order_nsu', orderNsu)
      .maybeSingle();
    
    if (cobrancaByNsu) {
      cobranca = cobrancaByNsu;
    } else {
      // Fallback por id (UUID)
      const { data: cobrancaById } = await supabase
        .from('cobrancas')
        .eq('id', orderNsu)
        .maybeSingle();
      cobranca = cobrancaById;
    }
    // Pular query principal
  }
```

---

## Arquivos a Modificar

| # | Arquivo | Alteração | Linhas Afetadas |
|---|---------|-----------|-----------------|
| 1 | `supabase/functions/infinitepay-webhook/index.ts` | Log imediato antes do parsing | L56-100 |
| 2 | `supabase/functions/infinitepay-webhook/index.ts` | Busca dupla (ip_order_nsu → id) | L120-160 |
| 3 | `supabase/functions/check-payment-status/index.ts` | Busca dupla com fallback | L86-117 |

---

## Fluxo de Busca Corrigido

```text
┌─────────────────────────────────────────────────────────────────┐
│ ORDEM DE BUSCA (Conforme Contrato 3.1.4)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Recebe order_nsu do payload                                 │
│     │                                                           │
│     ▼                                                           │
│  2. PASSO 1: Buscar por ip_order_nsu = order_nsu                │
│     │                                                           │
│     ├─► Encontrou? ──► Processar cobrança                       │
│     │                                                           │
│     └─► Não encontrou?                                          │
│         │                                                       │
│         ▼                                                       │
│  3. PASSO 2: Buscar por id = order_nsu (fallback UUID)          │
│     │                                                           │
│     ├─► Encontrou? ──► Processar cobrança                       │
│     │                                                           │
│     └─► Não encontrou? ──► Logar como 'ignored' + Retornar 200  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Compatibilidade Garantida Pós-Implementação

| Cenário | Comportamento Esperado |
|---------|------------------------|
| Gallery envia `gallery-123-abc` | Encontra por `ip_order_nsu` |
| Gestão envia UUID diretamente | Encontra por `id` (fallback) |
| Gestão envia `gestao-123-xyz` | Encontra por `ip_order_nsu` |
| Webhook recebe JSON inválido | Loga payload bruto antes de falhar |

---

## Validações Obrigatórias Pós-Deploy

1. **Pagamento com order_nsu = gallery-***
   - Criar cobrança no Gallery
   - Simular webhook com `order_nsu: "gallery-..."` 
   - Verificar se encontra por `ip_order_nsu`

2. **Pagamento com order_nsu = UUID**
   - Criar cobrança no Gestão (usando UUID)
   - Simular webhook com `order_nsu: "{uuid}"`
   - Verificar se encontra por `id` (fallback)

3. **Falha de webhook com recuperação**
   - Enviar JSON inválido ao webhook
   - Verificar se `webhook_logs` registrou o payload bruto
   - Confirmar que nenhum dado foi perdido

---

## Conformidade com Contrato

| Regra | Status Atual | Status Após |
|-------|--------------|-------------|
| 1.1 - UUID é identidade interna | ✅ Conforme | ✅ Conforme |
| 2.1 - ip_order_nsu é correlação externa | ✅ Conforme | ✅ Conforme |
| 3.1.2 - Log antes de qualquer processamento | ❌ Violado | ✅ Conforme |
| 3.1.4 - Ordem de busca fixa | ❌ Violado | ✅ Conforme |
| 4.2 - Fallbacks obrigatórios | ✅ Conforme | ✅ Conforme |
| 5.2 - Compatibilidade retroativa | ✅ Conforme | ✅ Conforme |

