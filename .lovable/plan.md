

## Plano: Correção do Webhook InfinitePay para Retorno de Pagamento

### Diagnóstico

Após investigação completa, identifiquei o problema raiz:

**PROBLEMA CRÍTICO**: O Edge Function `infinitepay-webhook` NÃO está registrado no `supabase/config.toml` com `verify_jwt = false`

**Consequência:**
- Quando a InfinitePay tenta enviar POST para o webhook após pagamento aprovado
- A requisição é REJEITADA porque requer autenticação JWT
- O webhook nunca processa a confirmação
- A galeria permanece com status "pendente" eternamente

**Evidência:**
```
# config.toml - FALTANDO infinitepay-webhook!
[functions.infinitepay-create-link]
verify_jwt = false
# infinitepay-webhook NÃO ESTÁ AQUI!
```

**Status no banco:**
```
cobrancas:
  - id: ccfa016e... 
  - status: "pendente"  ← Deveria ser "pago"
  - ip_order_nsu: "gallery-1769453601191-d2b4v0"
  
galerias:
  - session_id: workflow-1769228029906-xfjqylrod3
  - status_pagamento: "pendente"  ← Deveria ser "pago"
```

---

### Arquivos a Modificar

| # | Arquivo | Alteração |
|---|---------|-----------|
| 1 | `supabase/config.toml` | Adicionar config para `infinitepay-webhook` com `verify_jwt = false` |

---

### Correção Necessária

**Arquivo: `supabase/config.toml`**

Adicionar a seguinte entrada ao final do arquivo:

```toml
[functions.infinitepay-webhook]
verify_jwt = false
```

**Arquivo completo após correção:**
```toml
project_id = "tlnjspsywycbudhewsfv"

[functions.delete-photos]
verify_jwt = false

[functions.gallery-access]
verify_jwt = false

[functions.client-selection]
verify_jwt = false

[functions.confirm-selection]
verify_jwt = false

[functions.b2-upload]
verify_jwt = false

[functions.gallery-create-payment]
verify_jwt = false

[functions.infinitepay-create-link]
verify_jwt = false

[functions.infinitepay-webhook]
verify_jwt = false
```

---

### Por que `verify_jwt = false` é necessário?

A InfinitePay é um serviço EXTERNO que envia webhooks automaticamente após pagamentos. Ela não possui:
- Token JWT do Supabase
- Credenciais de autenticação do projeto

Sem `verify_jwt = false`, toda requisição da InfinitePay retorna **401 Unauthorized** e o webhook nunca é processado.

---

### Fluxo Após Correção

```
1. Cliente paga no checkout InfinitePay
2. InfinitePay envia POST para:
   https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/infinitepay-webhook
3. Supabase aceita requisição (verify_jwt = false) ✅
4. Webhook processa payload:
   - Busca cobranca por order_nsu
   - Atualiza cobrancas.status = 'pago'
   - Atualiza galerias.status_pagamento = 'pago'
   - Soma valor em clientes_sessoes.valor_pago
5. GalleryDetail exibe status "Pago" ✅
6. Workflow reflete valor_pago atualizado ✅
```

---

### Deploy Necessário

Após a correção:
- Redeploy do Edge Function `infinitepay-webhook`

O deploy é automático, mas a configuração no `config.toml` é aplicada imediatamente.

---

### Teste Manual (Opcional)

Para verificar se o webhook está funcionando, você pode simular uma chamada:

```bash
curl -X POST https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/infinitepay-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "order_nsu": "gallery-1769453601191-d2b4v0",
    "transaction_nsu": "test-123",
    "receipt_url": "https://example.com/receipt"
  }'
```

Se retornar `{"success": true, "message": "Payment processed"}`, o webhook está funcionando.

---

### Resumo

| Problema | Causa Raiz | Solução |
|----------|------------|---------|
| Pagamento não atualiza status | `infinitepay-webhook` requer JWT | Adicionar `verify_jwt = false` no config.toml |
| InfinitePay recebe 401 | Edge Function protegida | Desabilitar verificação JWT para webhooks externos |

