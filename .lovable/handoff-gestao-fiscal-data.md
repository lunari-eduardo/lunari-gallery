# Handoff — Dados Fiscais do Cliente (CPF/CNPJ + Endereço) para Antecipação Asaas

**Origem:** projeto Gallery (`lunari-gallery`)
**Destino:** projeto Gestão (`lunari-gestao`)
**Data:** 2026-07-03
**Contrato:** compartilhado (mesma base Supabase `tlnjspsywycbudhewsfv`)

---

## Contexto

Para que os fotógrafos possam **antecipar recebíveis no Asaas**, o cadastro do
cliente no Asaas precisa ter **`cpfCnpj`** obrigatoriamente, e:

- **Cartão (parcelado ou à vista)**: `name` + `cpfCnpj` obrigatórios; endereço
  fortemente recomendado para reduzir recusas por antifraude.
- **PIX / Boleto**: `name` + `cpfCnpj` + `phone` obrigatórios.

Sem esses campos, o botão "Antecipar" não aparece no painel Asaas.

Complemento: o **checkout hospedado** do Asaas aceita `customerData` no payload
de criação, o que **pré-preenche o formulário** do cliente e reduz abandono.

---

## Mudanças de schema (JÁ APLICADAS no banco compartilhado)

```sql
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS cpf_cnpj text,              -- 11 (CPF) ou 14 (CNPJ), só dígitos
  ADD COLUMN IF NOT EXISTS cep text,                    -- 8 dígitos, só dígitos
  ADD COLUMN IF NOT EXISTS endereco text,               -- logradouro
  ADD COLUMN IF NOT EXISTS endereco_numero text,
  ADD COLUMN IF NOT EXISTS endereco_complemento text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS uf text;                     -- 2 letras maiúsculas
```

Constraints de formato e índice único parcial `(user_id, cpf_cnpj)` já foram
criados. Sempre gravar em **dígitos puros** (sem máscara) para CPF/CNPJ e CEP.

---

## Módulos compartilhados atualizados

Os arquivos abaixo (no repo Gallery em `supabase/functions/_shared/`) foram
estendidos e **devem ser copiados idênticos para o repo Gestão**:

### `payer-hints.ts`

`PayerHints` agora inclui:

```ts
{
  firstName, fullName, email,
  phone, phoneParts,
  cpfCnpj,                    // 11 ou 14 dígitos, ou undefined
  address?: {
    postalCode, street, number, complement,
    province, city, state,    // UF 2 letras
  }
}
```

Além disso: `isAnticipationEligible(hints, billingType)` retorna `true/false` —
útil para logar/telemetria e sugerir coleta de dados no frontend.

### `enrich-cliente.ts`

`EnrichInput` agora aceita: `cpfCnpj`, `cep`, `endereco`, `enderecoNumero`,
`enderecoComplemento`, `bairro`, `cidade`, `uf`.

**Regra invariante:** cada coluna só é preenchida se estiver `NULL`/vazia no CRM.
**Nunca sobrescreve** dado existente. Deve ser chamado **após** confirmação do
pagamento (dados validados pelo provedor).

---

## Uso no Asaas (implementado no Gallery — replicar no Gestão)

### 1. Criação/atualização de customer

Ao criar ou atualizar um customer no Asaas (`POST/PUT /v3/customers`), enviar:

```json
{
  "name": "…",
  "email": "…",
  "phone": "…",
  "mobilePhone": "…",
  "cpfCnpj": "…",
  "postalCode": "…",
  "address": "…",
  "addressNumber": "…",
  "complement": "…",
  "province": "…",
  "cityName": "…",
  "state": "SP",
  "externalReference": "<cliente_id>"
}
```

**Update** (`PUT`) deve seguir a regra: só preencher campos que estejam
`null/empty` no customer atual (fetch → diff → PUT). Nunca sobrescrever.

### 2. Checkout hospedado (`POST /v3/checkouts`)

Injetar `customerData` no payload para pré-preencher formulário:

```json
{
  "customerData": {
    "name": "…",
    "email": "…",
    "phone": "…",
    "cpfCnpj": "…",
    "postalCode": "…",
    "address": "…",
    "addressNumber": "…",
    "complement": "…",
    "province": "…",
    "city": <ID_IBGE_NUMERICO>,
    "state": "SP"
  }
}
```

⚠️ **Atenção:** `city` no checkout hospedado exige **ID IBGE numérico**, não o
nome. Use a tabela `municipios_ibge` para converter. Se não tiver o ID, omita
apenas o `city` (o resto do prefill continua válido).

### 3. Cartão transparente (`creditCardHolderInfo`)

Além de enviar no payload de `/payments`, **sincronize** o CPF/endereço no
customer no Asaas depois (fetch → PUT com campos faltantes) para elegibilidade
de antecipação futura. Também chame `enrichClienteIfMissing` para salvar no CRM.

### 4. Webhook (`asaas-gallery-webhook` — replicar no equivalente do Gestão)

Após `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` / `PAYMENT_ANTICIPATED`:

```ts
// 1) buscar customer no Asaas
const cust = await fetch(`${env}/v3/customers/${payment.customer}`, { headers: { access_token }}).then(r => r.json());

// 2) enriquecer CRM
await enrichClienteIfMissing(supabase, clienteId, {
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

---

## Coleta de dados no frontend (recomendação para Gestão)

Como muitos clientes do CRM não têm CPF/endereço ainda, sugere-se:

1. **Modal opcional** ao abrir cobrança/checkout: se `clientes.cpf_cnpj` for
   `NULL`, exibir campos opcionais (CPF + CEP → autocompletar endereço via
   ViaCEP). Salvar via `enrichClienteIfMissing`.
2. **Aviso visual** no card do cliente ("Antecipação Asaas indisponível — falta
   CPF") quando `isAnticipationEligible` falhar. Não bloquear o fluxo — apenas
   informar.
3. **Regra**: campos fiscais são **opcionais no fluxo do fotógrafo** (não
   quebrar cobranças legadas). Só obrigatórios para checkout de cartão via
   Asaas quando `creditCardHolderInfo` já é exigido.

---

## Checklist de implementação (Gestão)

- [ ] Copiar `payer-hints.ts` e `enrich-cliente.ts` atualizados para o repo.
- [ ] Nas Edge Functions que criam/atualizam customer Asaas: usar
      `resolvePayerHints` e enviar objeto completo (cpfCnpj + endereço).
- [ ] Nas Edge Functions que criam checkout hospedado Asaas: injetar
      `customerData` (com resolução de cidade → IBGE quando disponível).
- [ ] No webhook Asaas de cobranças: chamar `enrichClienteIfMissing` com
      `cust.cpfCnpj/postalCode/address/...` após confirmação.
- [ ] Frontend (opcional/recomendado): modal de coleta CPF/CEP + integração
      ViaCEP; badge "faltam dados p/ antecipação" nos cards de cliente.
- [ ] Nunca gravar CPF/CNPJ com máscara — sempre dígitos puros.
- [ ] Nunca sobrescrever dado existente no CRM (regra invariante do enrich).

---

## Referências

- Asaas API: <https://docs.asaas.com/reference/criar-novo-cliente>
- Checkout hospedado: <https://docs.asaas.com/reference/criar-checkout>
- Requisitos antecipação: <https://ajuda.asaas.com/pt-BR/articles/6222440>
- Handoff anterior (prefill básico): `.lovable/handoff-gestao-prefill-checkout.md`
