

## Plano: Validação de Assinatura em Webhooks de Pagamento

### Situação atual
Nenhum dos 3 webhooks valida a origem da requisição. Qualquer pessoa que conheça a URL pode enviar um POST forjado e marcar cobranças como pagas.

### Mecanismos oficiais de cada gateway

| Gateway | Mecanismo | Header | Como funciona |
|---------|-----------|--------|---------------|
| **InfinitePay** | HMAC-SHA256 | `X-Infinia-Signature` | HMAC do body usando um shared secret (configurado no painel InfinitePay) |
| **Asaas** | Token fixo | `asaas-access-token` | Token definido pelo usuário no painel Asaas, enviado em todas as notificações |
| **Mercado Pago** | HMAC-SHA256 | `x-signature` | `ts={timestamp},v1={hash}` — HMAC do manifest `id:{data.id};request-id:{x-request-id};ts:{ts};` usando secret key |

### Secrets necessários

1. **`INFINITEPAY_WEBHOOK_SECRET`** — shared secret configurado no painel InfinitePay (novo)
2. **`ASAAS_WEBHOOK_TOKEN`** — token de autenticação configurado no painel Asaas (novo)
3. **`MERCADOPAGO_WEBHOOK_SECRET`** — secret signature gerada automaticamente ao configurar webhook no painel MP (novo)

Os 3 precisam ser adicionados como secrets no Supabase antes do deploy.

### Mudanças por arquivo

**1. `supabase/functions/infinitepay-webhook/index.ts`**
- Após ler o `rawBody` e antes de qualquer processamento, extrair header `x-infinia-signature`
- Computar HMAC-SHA256 do rawBody usando `INFINITEPAY_WEBHOOK_SECRET`
- Comparar com o header usando timing-safe comparison
- Se inválido: logar no `webhook_logs` com status `signature_invalid` e retornar 401
- Se secret não configurado: logar warning e continuar (graceful degradation para não quebrar em produção)

**2. `supabase/functions/asaas-webhook/index.ts`**
- Antes de processar o body, extrair header `asaas-access-token`
- Comparar com `ASAAS_WEBHOOK_TOKEN` (env)
- Se inválido: retornar 401
- Se secret não configurado: continuar com warning

**3. `supabase/functions/asaas-gallery-webhook/index.ts`**
- Mesmo mecanismo do `asaas-webhook`: validar `asaas-access-token` contra `ASAAS_WEBHOOK_TOKEN`
- Se inválido: retornar 401

**4. `supabase/functions/mercadopago-webhook/index.ts`**
- Extrair header `x-signature` e `x-request-id`
- Parsear `ts` e `v1` do header `x-signature`
- Construir manifest: `id:{data.id};request-id:{x-request-id};ts:{ts};`
- Computar HMAC-SHA256 do manifest usando `MERCADOPAGO_WEBHOOK_SECRET`
- Comparar com `v1`
- Se inválido: logar e retornar 401
- Se secret não configurado: continuar com warning

### Padrão de validação (aplicado nos 4 arquivos)

```text
Request recebida
  → Ler raw body + headers
  → Logar imediatamente (já existe)
  → VALIDAR ASSINATURA ← novo passo
     ├─ Secret não configurado → warning + continuar (graceful)
     ├─ Assinatura válida → continuar processamento
     └─ Assinatura inválida → logar "signature_invalid" → retornar 401
  → Processar pagamento (lógica existente)
```

### Graceful degradation
Todos os webhooks usam o padrão: se o secret correspondente **não estiver configurado** no ambiente, a validação é pulada com um `console.warn`. Isso garante que o sistema não quebre se o fotógrafo ainda não configurou o token no painel do gateway. Quando o secret existir, a validação é obrigatória.

### Pré-requisito do usuário
Após a implementação, o usuário precisará:
1. Configurar o webhook secret no painel da InfinitePay e adicionar como `INFINITEPAY_WEBHOOK_SECRET`
2. Configurar o authentication token no painel do Asaas e adicionar como `ASAAS_WEBHOOK_TOKEN`
3. Copiar a secret signature do painel do Mercado Pago e adicionar como `MERCADOPAGO_WEBHOOK_SECRET`

### Arquivos modificados
- `supabase/functions/infinitepay-webhook/index.ts`
- `supabase/functions/asaas-webhook/index.ts`
- `supabase/functions/asaas-gallery-webhook/index.ts`
- `supabase/functions/mercadopago-webhook/index.ts`

