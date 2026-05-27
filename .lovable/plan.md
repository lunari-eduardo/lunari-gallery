## Diagnóstico aprofundado

Investigação completa em `cobrancas`, `webhook_logs` e logs das Edge Functions.

### O que está funcionando ✅

As novas URLs (`https://api.checkout.infinitepay.io/links` e `/payment_check`) já estão ativas neste projeto Gallery e funcionaram em **3 cobranças confirmadas após o deploy**:

| Cobrança | Criada | Webhook | Status |
|---|---|---|---|
| `gallery-1779898745146-ll6gzq` | 16:19 | processed em 16:21 | pago ✅ |
| `gallery-1779908627534-1xxzir` | 19:03 | processed em 19:04 | pago ✅ |
| `gallery-1779912044093-admv67` | 20:00 | processed em 20:05 | pago ✅ |
| `gallery-1779912044885-p4j33q` | 20:00 | processed em 20:05 | pago ✅ |

Conclusão: `infinitepay-create-link` + `infinitepay-webhook` deste projeto estão 100% saudáveis com o novo endpoint.

### O que está travado ❌

Duas cobranças pendentes criadas às **17:46:11 e 17:46:15** com padrão muito diferente:

```
ip_order_nsu = id (UUID) — ex.: 9b94a534-bdd7-435b-8be3-ea1072ddaf60
descricao    = "Pagamento via InfinitePay"
galeria_id   = NULL
session_id   = "agenda-..."   ← prefixo do projeto Gestão
qtd_fotos    = 0
ip_checkout_url já populado (link real na InfinitePay)
```

Características que **comprovam** que essas cobranças **não foram criadas pela função deste projeto** (`infinitepay-create-link` gera `order_nsu = "gallery-{ts}-{rand}"`, nunca um UUID):

1. `ip_order_nsu = UUID` é o padrão usado pelo projeto **Gestão / lunari_gallery** (que compartilha o mesmo banco).
2. `session_id` com prefixo `agenda-` é gerado no Gestão (fluxo de sessões/agendamento), não no Gallery.
3. `webhook_logs` **não tem nenhum registro** para esses dois `order_nsu`, ou seja, a InfinitePay **nunca enviou webhook** para nosso endpoint.
4. O polling em `check-payment-status` recebe `{"success":false}` da nova URL `/payment_check` porque está enviando `handle + order_nsu(UUID) + transaction_nsu=undefined + slug=undefined` e a InfinitePay não localiza a ordem.

### Causa raiz real

**O projeto Gestão (`lunari_gallery`) tem sua própria função `infinitepay-create-link` que ainda está apontando para a URL antiga (`api.infinitepay.io/invoices/public/checkout/...`) ou tem `webhook_url` desatualizada.**

Como a URL antiga será desativada em 01/06/2026, qualquer cobrança criada por aquele projeto após o desligamento vai falhar. Hoje, mesmo antes do desligamento, o polling pelo nosso `check-payment-status` falha porque o novo `/payment_check` não retorna sucesso para cobranças nascidas no fluxo antigo do Gestão (ou a InfinitePay já mudou a chave de lookup para `slug`).

### Por que o webhook nunca chegou nessas 2

Três hipóteses (não temos como confirmar daqui sem ver logs do projeto Gestão):

1. **Pagamento não foi finalizado pelo cliente** (abandono no checkout).
2. **Webhook URL no payload da função do Gestão aponta para outro lugar** (não para `tlnjspsywycbudhewsfv`).
3. **Validação HMAC no Gestão** rejeitando a entrada (geraria `webhook_logs.status='signature_invalid'` se chegasse — não há registro, então não chegou).

---

## Plano de correção (este projeto Gallery)

### 1) Blindar o polling `check-payment-status` (alta prioridade)

A função hoje envia apenas `handle + order_nsu` para `/payment_check`. A documentação prática da InfinitePay mostra que `slug` (extraído do `ip_checkout_url`) é o identificador mais estável. Vamos:

a) Extrair o `slug` do `ip_checkout_url` (parte após o último `/` antes do `?`) quando disponível, e sempre enviá-lo no payload de `/payment_check`.

b) Logar a resposta completa da InfinitePay (status HTTP + body) para ter telemetria real do motivo de `success:false`.

c) Quando `success:false` por 3 polls consecutivos numa mesma cobrança, gravar `error_message` em `cobrancas` para o painel exibir "verificação automática indisponível — confirme manualmente".

### 2) Centralizar URLs em constantes

Criar no topo de `infinitepay-create-link/index.ts` e `check-payment-status/index.ts`:

```ts
const INFINITEPAY_API_BASE = Deno.env.get('INFINITEPAY_API_BASE') || 'https://api.checkout.infinitepay.io';
const INFINITEPAY_LINKS_URL = `${INFINITEPAY_API_BASE}/links`;
const INFINITEPAY_PAYMENT_CHECK_URL = `${INFINITEPAY_API_BASE}/payment_check`;
```

Assim qualquer mudança futura é uma linha só, ou um secret, sem editar código.

### 3) Verificação automática pós-deploy (smoke test)

Adicionar no início de cada função um log único `[INFINITEPAY_ENDPOINT_VERSION] v2-checkout-api` que aparece no boot. Isso garante que conseguimos provar nos logs qual versão está rodando em produção a qualquer momento.

### 4) Limpeza dos 2 registros órfãos

Marcar manualmente as 2 cobranças `9b94a534…` e `16d86621…` como `cancelada` (ou `expirada`) via migração, com `error_message = 'origem: projeto Gestão — fluxo antigo'`. Não impacta o cliente final porque `galeria_id` é NULL (não há galeria associada).

### 5) Relato cruzado para o projeto Gestão (`lunari_gallery`)

**Conforme regra do projeto: relatar imediatamente.** O projeto Gestão precisa, antes de 01/06/2026, aplicar exatamente as mesmas mudanças:

- Trocar `https://api.infinitepay.io/invoices/public/checkout/links` → `https://api.checkout.infinitepay.io/links` em `infinitepay-create-link`.
- Trocar `https://api.infinitepay.io/invoices/public/checkout/payment_check` → `https://api.checkout.infinitepay.io/payment_check` em qualquer função de verificação.
- Confirmar que `webhook_url` no payload aponta para `https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/infinitepay-webhook` (única função que finaliza cobranças no banco compartilhado).
- Garantir o mesmo `INFINITEPAY_WEBHOOK_SECRET` em ambos os projetos para validação HMAC.

Sem essa atualização, **todas as cobranças criadas pelo Gestão após 01/06/2026 vão quebrar**.

---

## Resumo executivo para o usuário

- As alterações de URL **não causaram** o travamento das 2 cobranças — elas vieram do projeto Gestão e nunca receberam webhook (provável abandono de pagamento ou webhook_url divergente).
- O fluxo deste projeto Gallery está saudável (4 cobranças finalizadas após o deploy).
- Vamos blindar o polling com `slug`, centralizar URLs, melhorar telemetria, limpar registros órfãos e exigir atualização no Gestão antes de 01/06/2026.

Aprova esse plano para eu aplicar?
