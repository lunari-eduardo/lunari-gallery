# Atualização dos Endpoints InfinitePay

A InfinitePay desativará as URLs antigas em **01/06/2026**. Precisamos trocar os endpoints antes dessa data, mantendo payloads, webhooks e todo o restante do fluxo intactos.

## Diagnóstico — onde as URLs estão hardcoded

Após varredura completa do projeto (`rg "api\.infinitepay\.io|checkout\.infinitepay\.io"`), as URLs antigas aparecem em **apenas 2 lugares**, ambos em Edge Functions:

1. `supabase/functions/infinitepay-create-link/index.ts` (linha 208)
   - `POST https://api.infinitepay.io/invoices/public/checkout/links` → criar link de cobrança
2. `supabase/functions/check-payment-status/index.ts` (linha 299)
   - `POST https://api.infinitepay.io/invoices/public/checkout/payment_check` → verificar status de pagamento

Nenhuma referência hardcoded no frontend, em variáveis de ambiente (`.env`), no Worker do Cloudflare, na função `infinitepay-webhook` (que apenas recebe webhooks da InfinitePay, não chama a API), nem em outros services.

## O que vai mudar

| Função | URL antiga | URL nova |
|---|---|---|
| `infinitepay-create-link` | `https://api.infinitepay.io/invoices/public/checkout/links` | `https://api.checkout.infinitepay.io/links` |
| `check-payment-status` | `https://api.infinitepay.io/invoices/public/checkout/payment_check` | `https://api.checkout.infinitepay.io/payment_check` |

## O que NÃO muda (blindagem)

- Payloads de request (handle, order_nsu, items, customer, redirect_url, webhook_url)
- Webhook URL configurado nos links (`/functions/v1/infinitepay-webhook`)
- Função `infinitepay-webhook` (recebe callbacks da InfinitePay — endpoint deles é mesmo)
- Lógica de retry/timeout (`fetchWithRetry`), auto-healing por NSU, polling em `GalleryDetail.tsx` e `ClientGallery.tsx`
- Tabela `cobrancas`, IDs já gerados, galerias/sessões existentes — apenas o host muda
- Variáveis de ambiente e secrets

## Plano de execução

1. **Editar `supabase/functions/infinitepay-create-link/index.ts`**
   - Trocar a URL na chamada `fetchWithRetry(...)` para `https://api.checkout.infinitepay.io/links`
2. **Editar `supabase/functions/check-payment-status/index.ts`**
   - Trocar a URL na chamada `fetch(...)` para `https://api.checkout.infinitepay.io/payment_check`
3. **Deploy automático** das duas Edge Functions (Lovable deploya automaticamente)
4. **Validação pós-deploy**
   - Conferir logs de `infinitepay-create-link` na primeira chamada (status 200 e `checkoutUrl` retornado)
   - Conferir logs de `check-payment-status` para uma cobrança pendente
   - Testar criação de cobrança real em galeria de teste e confirmar pagamento via webhook
   - Compatibilidade com cobranças antigas: o `order_nsu` continua o mesmo identificador, o novo endpoint reconhece todos os links já gerados (confirmado no comunicado da InfinitePay)

## Blindagem futura (opcional, recomendação)

Para evitar nova caça-ao-hardcode no futuro, sugiro centralizar as URLs em constantes no topo de cada função (ex.: `const INFINITEPAY_API_BASE = 'https://api.checkout.infinitepay.io'`). Faço isso junto, mantendo a mudança mínima e auditável.

## Riscos

- **Nenhum risco para galerias/sessões existentes** — apenas o host muda, IDs e fluxo de webhook permanecem
- Se o novo endpoint apresentar comportamento diferente (não esperado pelo comunicado), o rollback é trivial: reverter as duas linhas
