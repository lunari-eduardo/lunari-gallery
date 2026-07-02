# Handoff — Pré-preenchimento de Checkout + Enriquecimento de Cadastro

**Origem:** projeto Gallery (`lunari-gallery`)
**Destino:** projeto Gestão (`lunari-gestao`)
**Data:** 2026-07-02
**Contrato:** compartilhado (mesma base Supabase `tlnjspsywycbudhewsfv`)

## Contexto

O Gallery agora envia dados do pagador (**primeiro nome**, **email**, **telefone**)
ao criar links/checkouts InfinitePay / Asaas / Mercado Pago, e após a confirmação
do pagamento **enriquece** o cadastro (`clientes.email` / `clientes.telefone`)
apenas quando esses campos estiverem vazios no CRM.

O Gestão deve adotar o mesmo contrato em suas rotas próprias
(cobranças avulsas, entrada de sessão, planos, adicionais) para uniformizar UX
e melhorar a qualidade da base de contatos.

## Módulos compartilhados publicados

Ambos são idempotentes, silenciosos em erro (nunca quebram o fluxo principal)
e **não** dependem de nada específico do Gallery:

- `supabase/functions/_shared/payer-hints.ts`
  - `resolvePayerHints(supabase, { clienteId, visitorId })` → `{ firstName?, email?, phone?, phoneParts? }`
  - `payerHintsFlags(hints)` → string com booleanos para log (não expõe valores).
- `supabase/functions/_shared/enrich-cliente.ts`
  - `enrichClienteIfMissing(supabase, clienteId, { email?, telefone? })`

**Recomendo copiar os dois arquivos idênticos para o repo do Gestão** (mesmo
caminho `supabase/functions/_shared/`) — evita import cross-repo e mantém a
lógica congelada.

## Regras de negócio (invariantes)

1. **Só envia o primeiro nome** ao provedor — nunca nome completo.
   Fórmula: `nome.trim().split(/\s+/)[0]`.
2. **Email** — validação regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`. Se falhar, omite o campo.
   **Nunca** usar placeholder tipo `cliente@email.com` (o MP aceita omitir email na Preference; para PIX direto, retorne 400 pedindo identificação).
3. **Telefone** — normalizado para dígitos. Se vier com DDI 55 (12-13 dígitos), remove os dois primeiros.
   Para MP, quebra em `{ area_code, number }`.
4. **Enriquecimento** — só grava se a coluna atual for `NULL`/vazia.
   `whatsapp` **nunca** é sobrescrito automaticamente.
   `telefone` só é gravado se `telefone` E `whatsapp` estiverem vazios.
5. **Chamar `enrichClienteIfMissing` SOMENTE após confirmação real** (webhook do provedor). Assim garantimos que o dado foi validado pelo próprio checkout.
6. Se o cliente não existe (`cliente_id` = null — visitante público), o enriquecimento é no-op silencioso. Dado fica apenas no provedor.

## Payloads por provedor (referência oficial)

### InfinitePay — `POST /links`

Campos aceitos além do obrigatório (handle/items/order_nsu):

```json
{
  "customer": {
    "name": "Ana",
    "email": "ana@email.com",
    "phone_number": "11987654321"
  }
}
```

- Enviar **apenas** as chaves que existirem. Email/phone vazio ou inválido = 422.
- `phone_number` = string de dígitos, sem formatação.

### Asaas — customer (recurso persistido)

Ao criar/atualizar `POST /v3/customers` / `PUT /v3/customers/{id}`:

```json
{
  "name": "Ana Silva",
  "email": "ana@email.com",
  "phone": "11987654321",
  "mobilePhone": "11987654321",
  "externalReference": "<cliente_id>",
  "notificationDisabled": true
}
```

- O checkout hospedado (`invoiceUrl`) mostra o customer vinculado — basta manter os campos preenchidos.
- Ao **atualizar** um customer existente, só preencher `email`/`phone` se estiverem `NULL` no Asaas. Nunca sobrescrever ajustes manuais do fotógrafo no painel Asaas.

### Asaas — creditCardHolderInfo (checkout transparente)

```json
{
  "creditCardHolderInfo": {
    "name": "Ana",
    "email": "ana@email.com",
    "phone": "11987654321",
    "cpfCnpj": "12345678900",
    "postalCode": "01234000",
    "addressNumber": "123"
  }
}
```

- `cpfCnpj`, `postalCode`, `addressNumber` são **obrigatórios** e devem vir da UI (não temos no CRM).
- `name`/`email`/`phone` podem ser pré-preenchidos server-side via hints se o frontend enviar em branco.

### Mercado Pago — PIX direto (`POST /v1/payments`)

```json
{
  "transaction_amount": 100.0,
  "payment_method_id": "pix",
  "payer": {
    "email": "ana@email.com",
    "first_name": "Ana",
    "phone": { "area_code": "11", "number": "987654321" }
  }
}
```

- Email é **obrigatório** para PIX direto — se não houver, retorne 400 exigindo identificação do pagador.

### Mercado Pago — Preference (`POST /checkout/preferences`)

```json
{
  "payer": {
    "name": "Ana",
    "email": "ana@email.com",
    "phone": { "area_code": "11", "number": "987654321" }
  }
}
```

- Todas as chaves opcionais. Omitir se não houver dado válido.

## Payloads de retorno (para enriquecimento pós-pagamento)

### Asaas webhook

Payload tem `payment.customer` (ID). É preciso fazer `GET /v3/customers/{id}` para obter `email` + `mobilePhone`/`phone`.

### Mercado Pago webhook

Payload de `GET /v1/payments/{id}` traz:
```json
{
  "payer": {
    "email": "...",
    "phone": { "area_code": "11", "number": "987654321" }
  }
}
```

### InfinitePay webhook

**Não** traz dados do pagador no payload atual. Enriquecimento não é feito aqui.

## Como integrar no Gestão

### Passo 1 — copiar os shared files

Copiar exatos:
- `supabase/functions/_shared/payer-hints.ts`
- `supabase/functions/_shared/enrich-cliente.ts`

### Passo 2 — nas rotas de criação de cobrança

Em qualquer edge function que crie link/checkout (ex. `asaas-create-payment`,
`asaas-create-subscription`, MP checkouts do Gestão):

```ts
import { resolvePayerHints, payerHintsFlags } from '../_shared/payer-hints.ts';

const payerHints = await resolvePayerHints(supabase, {
  clienteId: body.clienteId,
  // visitorId opcional — no Gestão normalmente é null
});
console.log(`[PREFILL] ${payerHintsFlags(payerHints)}`);
```

Aplicar `payerHints` nos payloads seguindo as tabelas acima.

### Passo 3 — nos webhooks de confirmação

Após a lógica atual de `finalize`/`process`:

```ts
import { enrichClienteIfMissing } from '../_shared/enrich-cliente.ts';

// Asaas: buscar customer no Asaas, depois chamar
await enrichClienteIfMissing(supabase, cobranca.cliente_id, {
  email: customerData.email,
  telefone: customerData.mobilePhone || customerData.phone,
});

// MP: usar direto do payer
await enrichClienteIfMissing(supabase, cobranca.cliente_id, {
  email: mpPayment.payer?.email,
  telefone: mpPayment.payer?.phone
    ? `${mpPayment.payer.phone.area_code}${mpPayment.payer.phone.number}`
    : undefined,
});
```

## Checklist de validação

- [ ] Cliente com email+telefone → checkout abre pré-preenchido nos 3 provedores.
- [ ] Cliente com email vazio → checkout abre em branco no email; após pagar, `clientes.email` é atualizado pelo webhook.
- [ ] Cliente com email já cadastrado → mesmo pagando com outro email, `clientes.email` **não** é sobrescrito.
- [ ] Cliente com whatsapp cadastrado e telefone vazio → webhook **não** grava telefone (whatsapp tem prioridade).
- [ ] Email corrompido/inválido no CRM → helper omite envio ao provedor.
- [ ] Log `[<PROVIDER>_PREFILL] name=Y email=Y phone=N` presente sem expor valores.

## Arquivos alterados no Gallery (referência)

- `supabase/functions/_shared/payer-hints.ts` (novo)
- `supabase/functions/_shared/enrich-cliente.ts` (novo)
- `supabase/functions/infinitepay-create-link/index.ts` (prefill customer)
- `supabase/functions/mercadopago-create-link/index.ts` (prefill PIX + Preference, removeu fallback `cliente@email.com`)
- `supabase/functions/asaas-gallery-payment/index.ts` (prefill customer + fallback creditCardHolderInfo)
- `supabase/functions/mercadopago-webhook/index.ts` (enrichment pós-pagamento)
- `supabase/functions/asaas-gallery-webhook/index.ts` (enrichment pós-pagamento via GET customer)

## Notas de segurança (LGPD)

- Todos os dados pertencem ao mesmo `user_id` (fotógrafo). Nenhum dado cruza tenants.
- Enriquecimento só grava dados **que o próprio pagador digitou e o provedor validou** — não estamos inferindo nem enriquecendo com fontes externas.
- Logs contêm apenas booleanos (`name=Y email=Y`), nunca valores.
