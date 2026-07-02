# Handoff — Checkout Completo (Prefill + Coleta + UI Asaas) para o projeto Gestão

**Origem:** projeto Gallery (`lunari-gallery`)
**Destino:** projeto Gestão (`lunari-gestao`)
**Data:** 2026-07-03
**Base de dados:** compartilhada (Supabase `tlnjspsywycbudhewsfv`)

Este documento consolida **todas** as mudanças recentes do Gallery em torno de
checkout (InfinitePay / Asaas / Mercado Pago) e explica o que o Gestão precisa
revisar / copiar para manter paridade de comportamento, UX e requisitos fiscais
(antecipação Asaas).

Ele **complementa** e **substitui** parcialmente os handoffs anteriores:
- `.lovable/handoff-gestao-prefill-checkout.md` (prefill básico — 2026-07-02)
- `.lovable/handoff-gestao-fiscal-data.md` (CPF/CNPJ + endereço — 2026-07-03)
- `.lovable/handoff-gestao-client-fields.md`
- `.lovable/handoff-gestao-extras.md`

Leia-os também. Aqui está o que mudou **depois** deles + o que replicar.

---

## 1. Resumo das mudanças recentes (Gallery)

### 1.1 Coleta antecipada de dados no checkout (novo)

Antes: um modal (`ContactCollectionModal`) abria **em cima** da tela de PIX
quando o pagador não tinha nome/email/telefone/CPF. UX ruim (modo escuro
forçado, quebra de fluxo).

Agora:
- Os campos (nome, email, telefone, **CPF/CNPJ**) foram **incorporados ao
  próprio card de checkout** (`AsaasCheckout.tsx`). O cliente preenche tudo
  **antes** de clicar em "Gerar QR/Cobrança".
- Auto-avanço entre inputs (blur ao completar máscara, `enterKeyHint="next"`,
  focus programático).
- Máscara dinâmica CPF↔CNPJ (`src/lib/validateCpfCnpj.ts`), validação de
  dígito verificador **client-side** antes de disparar a chamada.
- O card respeita o **tema visual da galeria do fotógrafo** (não força
  dark-mode). Se o Gestão usa tema próprio, a cópia deve trocar `bg-white`,
  `text-slate-*` etc. por tokens semânticos do design system do Gestão.
- Após o pagamento, os dados são **persistidos no cadastro do cliente**
  (`clientes.*`) via `enrichClienteIfMissing`, respeitando a regra de
  invariante: nunca sobrescrever campo já preenchido no CRM.

### 1.2 Filtro ASCII em emails (Asaas)

O Asaas **rejeita** `POST/PUT /v3/customers` com email contendo caracteres
não-ASCII (ex.: `joãozinho@gmail.com`, cirílico, emoji). Isso derruba a
sincronização de `cpfCnpj`/`phone` porque a request inteira volta 400 e o
customer fica sem os campos → **cobrança PIX falha com** `"Para criar esta
cobrança é necessário preencher o CPF ou CNPJ do cliente"`.

Correções aplicadas:
- `supabase/functions/_shared/payer-hints.ts` — `normalizeEmail` rejeita
  qualquer string com caractere fora de `\x00-\x7F`. Se o CRM tem email com
  acento, `hints.email` volta `undefined` e o frontend pergunta novamente.
- `supabase/functions/asaas-gallery-payment/index.ts`:
  - `isAsaasSafeEmail(email)` — regex `[\x21-\x7E]+@[a-zA-Z0-9.-]+\.[a-z]{2,}`.
  - `putAsaasCustomer(customerId, payload)` — helper resiliente: se o PUT
    falha com `invalid_email`, tenta de novo **sem** o campo `email`. Garante
    que CPF/phone sejam persistidos mesmo quando o email é rejeitado.
  - **Defense-in-depth** antes de criar cobrança PIX/BOLETO:
    `GET /v3/customers/{id}` → se `cpfCnpj` estiver vazio, faz um `PUT`
    dedicado só com `{ cpfCnpj }` antes de disparar o `POST /v3/payments`.
  - Novo código de erro `INVALID_EMAIL` mapeado no response.

### 1.3 UX no frontend (`AsaasCheckout.tsx`)

- Erros do backend mapeados 1:1 para mensagens em português (`INVALID_CPF`,
  `INVALID_EMAIL`, `MISSING_CPF`, `MISSING_PHONE`, `ASAAS_CUSTOMER_ERROR`,
  `PIX_GENERATION_FAILED`).
- Ao receber `INVALID_EMAIL`, o card **limpa** o QR gerado, foca o input de
  email e mostra: "Este email não é aceito pelo Asaas. Use um email sem
  acentos ou caracteres especiais."
- Botão "Gerar cobrança" só habilita quando: nome ok + email ASCII válido +
  telefone 10-11 dígitos + CPF/CNPJ com dígito verificador correto.

---

## 2. O que o Gestão precisa fazer

### 2.1 Copiar os shared modules (idênticos)

Copiar tal-e-qual do Gallery para `supabase/functions/_shared/` no repo Gestão:

- `payer-hints.ts` — resolve hints (nome, email ASCII, telefone, cpfCnpj,
  endereço) a partir de `clientes` e (opcional) `galeria_visitantes`.
- `enrich-cliente.ts` — grava no CRM só o que estiver vazio.

Não fork, não adapte: mantenha 1:1 para congelar a regra de negócio.

### 2.2 Copiar helpers do Asaas para dentro das edge functions

Nas edge functions do Gestão que criam customer / cobrança no Asaas
(`asaas-create-payment`, `asaas-create-subscription`, qualquer cobrança avulsa),
copiar estes helpers de `asaas-gallery-payment/index.ts`:

```ts
function isAsaasSafeEmail(email?: string | null): boolean {
  if (!email) return false;
  return /^[\x21-\x7E]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

async function putAsaasCustomer(baseUrl, accessToken, customerId, payload) {
  // 1ª tentativa: payload completo
  // Se resposta contiver `invalid_email` (ou 400 com esse code),
  // retenta SEM o campo email — mantém cpfCnpj/phone/etc.
}
```

E aplicar o pré-check **antes** de criar cobrança PIX/BOLETO:

```ts
const cust = await fetch(`${baseUrl}/v3/customers/${customerId}`, {
  headers: { access_token }
}).then(r => r.json());
if (!cust.cpfCnpj && hints.cpfCnpj) {
  await putAsaasCustomer(baseUrl, accessToken, customerId, {
    cpfCnpj: hints.cpfCnpj,
  });
}
```

Sem esse pré-check, cobranças de clientes legados (criados antes da
sincronização de CPF) continuarão falhando com 400.

### 2.3 Payloads por provedor — checklist rápido

Ver `.lovable/handoff-gestao-prefill-checkout.md` para o payload completo de
cada provedor. **Adicionar** em todas as chamadas:

| Provedor | Campos a enviar (além do valor) |
|---|---|
| InfinitePay `POST /links` | `customer.name` (primeiro nome), `customer.email` (ASCII válido), `customer.phone_number` |
| Asaas `POST/PUT /v3/customers` | `name`, `email` (ASCII), `phone`, `mobilePhone`, `cpfCnpj`, `postalCode`, `address`, `addressNumber`, `complement`, `province`, `cityName`, `state`, `externalReference=<cliente_id>` |
| Asaas `POST /v3/checkouts` (hospedado) | `customerData` completo — `city` exige **ID IBGE numérico** (tabela `municipios_ibge`); se não tiver, **omita apenas `city`** |
| Asaas `POST /v3/payments` (cartão transparente) | `creditCardHolderInfo` com `name`, `email`, `phone`, `cpfCnpj`, `postalCode`, `addressNumber` — **e** sincronizar CPF/endereço no customer via `putAsaasCustomer` **depois** |
| MP PIX direto `POST /v1/payments` | `payer.email` **obrigatório** (ASCII), `first_name`, `phone.{area_code,number}` |
| MP Preference | `payer.name`, `payer.email`, `payer.phone` — todos opcionais, omitir se inválido |

### 2.4 Obrigações do PIX Asaas (crítico)

Para o `POST /v3/payments` com `billingType: "PIX"` funcionar sem 400:

1. **Customer no Asaas precisa ter `cpfCnpj` preenchido.** Sem isso, o Asaas
   retorna: *"Para criar esta cobrança é necessário preencher o CPF ou CNPJ do
   cliente."*
2. **Customer precisa ter `mobilePhone` ou `phone` preenchido.**
3. **Nome** obrigatório (usar `firstName` do hint).
4. Se o email não for ASCII válido, **remova-o** do payload de customer antes
   do PUT (o `putAsaasCustomer` já faz isso).
5. `dueDate` no PIX deve ser hoje ou futuro (`YYYY-MM-DD`).
6. Sempre **preferir criar/atualizar customer antes** e usar o `customer` no
   payment. Nunca criar payment sem customer vinculado ao `cliente_id` do CRM
   (senão o webhook não consegue enriquecer).

**Cartão** exige `name + cpfCnpj` para antecipação (endereço recomendado).
**Boleto** exige os mesmos campos do PIX. Ver
`.lovable/handoff-gestao-fiscal-data.md` seção "Contexto".

### 2.5 Webhooks (enriquecimento pós-pagamento)

Nos webhooks do Gestão de cada provedor, após confirmar pagamento
(`PAYMENT_CONFIRMED`/`RECEIVED`, `payment.approved` etc.), chamar:

```ts
import { enrichClienteIfMissing } from '../_shared/enrich-cliente.ts';

// Asaas: buscar customer no Asaas primeiro (payload webhook só traz o ID)
const cust = await fetch(`${env}/v3/customers/${payment.customer}`, {
  headers: { access_token }
}).then(r => r.json());
await enrichClienteIfMissing(supabase, cobranca.cliente_id, {
  email: cust.email,
  telefone: cust.mobilePhone || cust.phone,
  cpfCnpj: cust.cpfCnpj,
  cep: cust.postalCode,
  endereco: cust.address,
  enderecoNumero: cust.addressNumber,
  enderecoComplemento: cust.complement,
  bairro: cust.province,
  cidade: cust.city || cust.cityName,
  uf: cust.state,
});
```

InfinitePay não devolve dados do pagador no webhook — enriquecimento não é
feito ali. Mercado Pago traz `payer.email` e `payer.phone` diretamente.

### 2.6 Frontend — reaproveitar UI do Gallery

**Arquivo modelo para copiar UI/UX do checkout Asaas:**

```
src/components/AsaasCheckout.tsx
```

É o componente completo do Gallery que:
- Renderiza campos (nome, email, telefone, CPF/CNPJ) **inline** no card, com
  máscara dinâmica, auto-avanço, validação client-side.
- Suporta troca entre PIX / Cartão / Boleto no mesmo card.
- Trata todos os códigos de erro do backend com mensagens em pt-BR.
- Respeita o tema visual da galeria (não força dark mode) — usa tokens
  semânticos (`text-foreground`, `bg-card`, etc.) e não `bg-white`/`bg-black`
  hardcoded.
- Mostra QR PIX, copia-e-cola, contador de expiração e polling de status.
- Reseta o QR quando o usuário edita dados (força re-geração para não pagar
  em cobrança stale).

**Recomendação:** o Gestão deve **copiar esse componente** para
`src/components/` e adaptar apenas:
1. O endpoint da edge function (`asaas-gallery-payment` → equivalente do
   Gestão, ex. `asaas-create-payment`).
2. Os tokens de tema para o design system do Gestão (glass, cores, etc.).
3. Callbacks de sucesso (o Gallery redireciona para tela de pagamento
   confirmado; o Gestão pode fechar modal / atualizar lista de cobranças).

Componente auxiliar para copiar junto (caso queira manter o padrão de coleta
em modal em algum ponto específico):

```
src/components/ContactCollectionModal.tsx  ← modal legado (não recomendado como default)
src/lib/validateCpfCnpj.ts                 ← máscara + validação DV oficial
```

Preferência: **inline no card** (ver `AsaasCheckout.tsx`). Modal só se o
fluxo do Gestão exigir (ex.: cobrança em massa onde o usuário abre uma
cobrança já com QR pronto).

### 2.7 Checklist de revisão nos meios de cobrança do Gestão

Passar em cada função/tela:

- [ ] `asaas-create-payment` — usa `resolvePayerHints`? envia `customerData`
      completo? tem `putAsaasCustomer` resiliente? pré-check de `cpfCnpj`?
- [ ] `asaas-create-subscription` — cria customer com todos os campos fiscais?
- [ ] `asaas-webhook` (Gestão) — chama `enrichClienteIfMissing` após buscar
      customer no Asaas?
- [ ] `mercadopago-create-link` / `mercadopago-pix` — envia `payer.email`
      (ASCII), `first_name`, `phone.{area_code,number}`?
- [ ] `mercadopago-webhook` — chama `enrichClienteIfMissing` com
      `payer.email` + telefone concatenado?
- [ ] `infinitepay-create-link` — envia `customer.name/email/phone_number`?
      **Nunca alterar sem revisar automação** (regra do projeto).
- [ ] Frontend de nova cobrança: coleta CPF/CNPJ + telefone **antes** de
      gerar PIX/Boleto/Cartão? Máscara dinâmica? Validação DV?
- [ ] Frontend de cadastro do cliente: alerta quando email tem acento
      (impede sync com Asaas)?
- [ ] Nunca gravar CPF/CNPJ ou CEP com máscara no DB — sempre dígitos puros.
- [ ] Nunca sobrescrever `whatsapp` automaticamente (canal do fotógrafo).

---

## 3. Arquivos de referência no Gallery

Sempre que houver dúvida, consultar (no repo Gallery):

| Arquivo | O que ver |
|---|---|
| `src/components/AsaasCheckout.tsx` | UI/UX completa do checkout — **copiar** |
| `src/components/ContactCollectionModal.tsx` | Modal legado (fallback) |
| `src/lib/validateCpfCnpj.ts` | Máscara + validação CPF/CNPJ |
| `supabase/functions/_shared/payer-hints.ts` | Hints ASCII-safe — **copiar** |
| `supabase/functions/_shared/enrich-cliente.ts` | Enrich idempotente — **copiar** |
| `supabase/functions/asaas-gallery-payment/index.ts` | `isAsaasSafeEmail`, `putAsaasCustomer`, pré-check CPF |
| `supabase/functions/asaas-gallery-webhook/index.ts` | GET customer + enrich |
| `supabase/functions/mercadopago-create-link/index.ts` | Payload MP correto |
| `supabase/functions/mercadopago-webhook/index.ts` | Enrich pós-pagamento MP |
| `supabase/functions/infinitepay-create-link/index.ts` | Prefill InfinitePay |
| `src/pages/ClientGallery.tsx` | Como o checkout é montado no fluxo público |
| `supabase/functions/gallery-access/index.ts` | Contrato de resolução do cliente + hints |

---

## 4. Notas finais

- **Nunca** desatualize funções InfinitePay sem revisar webhooks (regra fixa
  do projeto — automação de cobrança depende disso).
- Toda cobrança do Gestão deve estar apta a **antecipação Asaas** — o que só
  acontece se `cpfCnpj` estiver no customer. Priorize sempre coletar CPF no
  fluxo, mesmo que opcional na UI.
- LGPD: não inferimos dados. Só gravamos o que o **próprio pagador digitou** e
  o **provedor validou** durante um pagamento real.
- Logs: usar `payerHintsFlags(hints)` para logar `name=Y email=Y phone=Y
  cpf=Y addr=Y(...)` — nunca valores.

Dúvidas sobre a implementação atual do Gallery: abrir os arquivos da tabela
acima; todos estão comentados com as regras de negócio no topo.
