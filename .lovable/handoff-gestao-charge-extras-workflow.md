## 0. Contexto e princípio inegociável

O Gallery já possui um pipeline canônico e blindado para gerar cobrança
de extras. Esse pipeline:

1. Lê o **valor canônico** via RPC `calculate_gallery_extra_payment`.
2. Cancela cobranças pendentes anteriores da mesma galeria
   (`finalidade='fotos_extras'`, status `pendente|aguardando_confirmacao`).
3. Descobre o provedor ativo em `usuarios_integracoes` (com fallback).
4. Cria a cobrança no provedor correto (InfinitePay, Mercado Pago,
   Asaas, PIX Manual) com `finalidade='fotos_extras'` e `galeria_id`
   preenchidos — respeitando o contrato do
   `handoff-gestao-extras.md` (regra R4 do `gallery-rules.md`).
5. Devolve `checkoutUrl` / `transparentCheckout` / `pixDados`.
6. Marca `galerias.status_pagamento='pendente'`.
7. Deixa os webhooks/`finalize_gallery_payment` cuidarem do resto.

**O Gestão NÃO deve reimplementar nada disso.** Deve apenas chamar a
mesma edge function que o Gallery chama e apresentar o resultado no
UI do Workflow/CRM.

Edge function canônica: **`gallery-create-payment`** (projeto Gallery,
mesmo Supabase compartilhado).

---

## 1. O que precisa ser implementado no Gestão

### 1.1 Novo botão no card do Workflow / CRM

No card que hoje exibe "R$ X em fotos extras pendente" (Workflow e
CRM), adicionar uma ação **"Cobrar extras"** (ícone + label). Regras
de exibição:

- Aparece apenas se `galeria_id` existe **e** `valor_extras_pendente > 0`
  segundo a RPC `calculate_gallery_extra_payment(p_gallery_id)`.
- Nunca aparece se `is_fully_paid === true` retornado pela mesma RPC.
- Coexiste com o botão "Cobrar sessão" (já existente), sem restrição
  de ordem — o fotógrafo pode cobrar extras antes do pacote.

### 1.2 Modal de confirmação (não é ChargeModal genérico)

O modal existente `ChargeModal` continua para cobranças de sessão. Para
extras, criar um **`ExtraChargeModal`** dedicado — mais simples, sem
inputs editáveis:

```
┌─────────────────────────────────────────────┐
│  Cobrar fotos extras                        │
│  Galeria: {nome_sessao}                     │
│  Cliente: {cliente.nome}                    │
├─────────────────────────────────────────────┤
│  Extras selecionadas: 5                     │ ← readonly (calc.extras_a_cobrar)
│  Valor unitário: R$ 23,00                   │ ← readonly (calc.valor_unitario)
│  Já pago:        R$ 0,00                    │ ← readonly (calc.valor_pago)
│  Total a cobrar: R$ 115,00                  │ ← readonly (calc.valor_a_cobrar)
│  Regra aplicada: faixa 4–7 (congelada)      │ ← calc.rules_source
├─────────────────────────────────────────────┤
│  Meio de pagamento: [ InfinitePay ▾ ]       │ ← default = venda_pagamento_provedor
│                                              │
│  [ Cancelar ]              [ Gerar cobrança ] │
└─────────────────────────────────────────────┘
```

**Regras obrigatórias do modal**:

- Quantidade de extras: **readonly**. Vem de `calc.extras_a_cobrar`.
  Ajustes acontecem apenas no card do Workflow (rota já existente).
- Valor total: **readonly**. Vem de `calc.valor_a_cobrar`. Não há input
  de valor — se o fotógrafo achar que o valor está errado, precisa
  ajustar a seleção da galeria ou a regra congelada, não a cobrança.
- Meio de pagamento: dropdown com os provedores ativos em
  `usuarios_integracoes` do user (mesmo filtro que
  `gallery-create-payment` usa). Default =
  `galerias.venda_pagamento_provedor`. Inclui `pix_manual` quando
  configurado.
- Botão desabilitado se `calc.valor_a_cobrar <= 0` (mostra estado
  "Galeria já quitada"). Nesse caso mostra badge verde no card e não
  abre o modal.

### 1.3 Handler do botão "Gerar cobrança"

Chamar **diretamente** `gallery-create-payment` via fetch com
`SUPABASE_SERVICE_ROLE_KEY` (padrão cross-project já consolidado — ver
memory `padrao-chamadas-internas-functions`):

```ts
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const resp = await fetch(`${supabaseUrl}/functions/v1/gallery-create-payment`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`, // JWT do fotógrafo
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  },
  body: JSON.stringify({
    galleryId,                       // uuid da galeria
    provider: selectedProvider,      // 'infinitepay' | 'mercadopago' | 'asaas' | 'pix_manual'
    descricao: `Fotos extras - ${nomeSessao}`,
  }),
});
const data = await resp.json();
```

**Nunca** enviar `valorTotal` ou `extraCount` no payload — a edge
function ignora esses campos e recalcula pela RPC canônica. Enviá-los
apenas polui logs.

**Nunca** invocar SDK `supabase.functions.invoke()` cross-project — usar
`fetch` puro com URL absoluta (VITE_SUPABASE_URL aponta para o mesmo
projeto Supabase compartilhado).

### 1.4 Roteamento da resposta (idêntico ao `handleRegenerateCharge` do Gallery)

`gallery-create-payment` retorna um destes formatos. O Gestão precisa
tratar cada um:

| Retorno                                                                          | Ação no Gestão                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{ code: 'NO_AMOUNT_DUE', alreadyPaid: true }`                                   | Toast "Galeria já quitada". Fechar modal, recarregar card.                                                                                                                                                           |
| `{ checkoutUrl }` (InfinitePay/MercadoPago)                                      | Abrir `checkoutUrl` em nova aba. Toast "Link gerado — cliente pode pagar". Copiar link para clipboard e mostrar botão "Copiar link" + "Enviar por WhatsApp".                                                         |
| `{ transparentCheckout: true, provedor: 'asaas', galleryUrl }`                   | Não há checkout no Gestão. Mostrar mensagem: "Cobrança Asaas criada. Envie o link da galeria ao cliente — o checkout abre automaticamente." + botão "Copiar link da galeria" (`galleryUrl`) + "Enviar por WhatsApp". |
| `{ provedor: 'pix_manual', pixDados }`                                           | Mesma UX do PIX Manual do Workflow atual — mostrar QR + copia-e-cola.                                                                                                                                                |
| `{ code: 'NO_PROVIDER' }` (400)                                                  | Toast erro "Configure um meio de pagamento em Configurações".                                                                                                                                                        |
| `{ code: 'GATEWAY_TIMEOUT' \| 'GATEWAY_UNREACHABLE' \| 'PAYMENT_CREATE_ERROR' }` | Toast erro com `data.error`. Botão "Tentar novamente" no modal.                                                                                                                                                      |
| Qualquer outro `success:false`                                                   | Toast erro genérico com `data.error`.                                                                                                                                                                                |

**Importante**: para Asaas, o Gestão **não** exibe o formulário
transparente. O contrato é: cliente sempre paga Asaas dentro da
galeria pública. O Gestão apenas dispara a criação da cobrança e
compartilha o `galleryUrl`.

### 1.5 Após criar a cobrança

- Invalidar `queryClient` das queries de cobrancas e da RPC
  `calculate_gallery_extra_payment` para o card do Workflow atualizar.
- Não fazer polling manual — os webhooks + Realtime em `cobrancas` já
  atualizam o status. Se o Workflow precisar de atualização em tempo
  real, subscrever a `cobrancas` filtrado por `galeria_id`
  (segue padrão da memory `realtime-payment-synchronization`).

---

## 2. O que o Gestão NÃO deve fazer

- **Não** criar cobrança em `cobrancas` diretamente do Gestão para
  extras. Todo INSERT com `finalidade='fotos_extras'` deve passar por
  `gallery-create-payment` para respeitar R4 (finalidade + galeria_id
  - snapshot + qtd_fotos + validação de sobrecobrança).
- **Não** chamar `infinitepay-create-link`, `mercadopago-create-link`
  ou `asaas-gallery-payment` diretamente. Esses são chamados pela
  `gallery-create-payment` — chamá-los diretamente vai bypassar o
  cancelamento de cobranças antigas e o cálculo canônico.
- **Não** aceitar `valor` ou `qtd_fotos` editável no modal.
- **Não** deixar o fotógrafo escolher "cobrar como sessão" o valor de
  extras. O trigger `tg_protect_no_overcharge` + a lógica do handoff
  `handoff-gestao-extras.md` bloqueiam esse caminho — se o Gestão
  tentar, receberá `AMBIGUOUS_PURPOSE_USE_FOTOS_EXTRAS` ou
  `EXTRA_PAYMENT_EXCEEDS_IDEAL`.
- **Não** duplicar a lógica de descoberta de provedor
  (`usuarios_integracoes`). Confie na resposta da edge function.
- **Não** mexer em `finalize_gallery_payment`,
  `calculate_gallery_extra_payment`,
  `tg_classify_cobranca_finalidade` ou
  `tg_protect_no_overcharge` — são contrato compartilhado.

---

## 3. Independência de ordem: extras antes do pacote

Requisito explícito: o fotógrafo pode cobrar extras **antes** do valor
do pacote, ou vice-versa, sem restrição.

Isso já é suportado pelo contrato atual porque:

- Cobrança de sessão (`finalidade='sessao'`) e cobrança de extras
  (`finalidade='fotos_extras'`) são registros independentes em
  `cobrancas`.
- `recompute_session_paid` soma apenas cobranças com
  `finalidade='sessao'` no valor pago da sessão.
- `calculate_gallery_extra_payment` soma apenas cobranças com
  `finalidade='fotos_extras'` e `galeria_id` correto.
- Não existe FK forçando ordem, nem trigger que exija sessão paga
  antes de extras.

**Ação do Gestão**: garantir que os dois botões ("Cobrar sessão" e
"Cobrar extras") sejam habilitados independentemente. Não colocar
`disabled` cruzado entre eles.

---

## 4. Estado visual do card do Workflow

Após esta implementação, o card deve refletir 3 estados independentes,
cada um lido de fonte própria:

| Bloco                              | Fonte                                                                                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Sessão — valor pago / pendente** | `SUM(cobrancas.valor)` onde `session_id=? AND finalidade='sessao' AND status IN ('pago','pago_manual')` vs `clientes_sessoes.valor_total` |
| **Extras — valor pago / pendente** | RPC `calculate_gallery_extra_payment(galeria_id)` — usar `valor_pago`, `valor_a_cobrar`, `extras_a_cobrar`                                |
| **Status geral da galeria**        | `galerias.status_selecao` + `galerias.status_pagamento` (informativo)                                                                     |

Nunca misturar "sessão + extras" no mesmo total. Isso é o que causou o
bug da Clarissa (vide handoff-gestao-extras.md).

---

## 5. Checklist de implementação

- [ ] Novo `ExtraChargeModal.tsx` (readonly, sem inputs de valor/qtd).
- [ ] Botão "Cobrar extras" no card do Workflow, condicional a
      `calc.valor_a_cobrar > 0`.
- [ ] Botão "Cobrar extras" no CRM (detalhe do cliente → galerias da
      sessão).
- [ ] Handler que chama `gallery-create-payment` via `fetch` cross-
      project com JWT do fotógrafo.
- [ ] Roteamento dos 6 retornos da tabela em 1.4.
- [ ] Não permitir edição de valor/qtd em nenhuma UI de cobrança de
      extras.
- [ ] Botão "Cobrar sessão" e "Cobrar extras" independentes — sem
      ordem obrigatória.
- [ ] Invalidar queries + subscribe Realtime em `cobrancas` filtrado
      por `galeria_id` para refresh automático do card.
- [ ] Testes manuais dos 4 provedores: InfinitePay, Mercado Pago,
      Asaas, PIX Manual.
- [ ] Regressão: cobrança de sessão continua funcionando pelo
      `ChargeModal` original.

---

## 6. Casos de teste obrigatórios

1. **InfinitePay** — Galeria com 5 extras, R$ 115 pendentes. Clicar
   "Cobrar extras" → modal readonly → gerar → `checkoutUrl` retorna,
   abre em nova aba, link copiado. Após pagar (sandbox), webhook
   marca `cobrancas.status='pago'`, `finalize_gallery_payment` roda,
   galeria fica `selecao_completa`+`pago`, sessão não recebe crédito
   nos R$ 115.
2. **Mercado Pago** — Idem, `checkoutUrl` retorna.
3. **Asaas** — Retorna `transparentCheckout:true`, Gestão mostra
   apenas link da galeria + botão WhatsApp. Cliente abre galeria →
   Asaas transparente carrega automaticamente.
4. **PIX Manual** — Retorna `pixDados`, Gestão mostra QR/copia-cola.
   Cliente informa pagamento na galeria → `finalize_payment` marca
   `aguardando_confirmacao`.
5. **Já quitada** — Galeria com 0 extras pendentes → botão fica
   desabilitado ou some, RPC retorna `is_fully_paid:true`.
6. **Extras antes de sessão** — Sessão com R$ 500 pendentes e galeria
   com R$ 115 extras pendentes. Cobrar extras primeiro → funciona,
   sessão continua pendente. Depois cobrar sessão → funciona
   independentemente.
7. **Sobrecobrança tentada** — Se alguém tentar bypassar e chamar
   `gallery-create-payment` com galeria já quitada → retorna
   `NO_AMOUNT_DUE` sem criar cobrança.
8. **Reabertura de galeria** — Após `reopen_gallery_selection`, cliente
   seleciona mais fotos, Gestão vê novo saldo em
   `calculate_gallery_extra_payment` e consegue gerar nova cobrança.

---

## 7. Referências obrigatórias

- `.lovable/gallery-rules.md` — regras R1–R10 (Gallery).
- `.lovable/handoff-gestao-extras.md` — contrato de finalidade e
  transações financeiras.
- `.lovable/handoff-gestao-egress-reduction.md` — padrão de queries
  enxutas, não usar `select('*')` no card do Workflow.
- Memory `padrao-chamadas-internas-functions` — usar `fetch` com
  service role para chamadas entre projetos.
- Memory `finalize-gallery-payment-atomic-sync` — RPC canônica de
  sincronização galeria/sessão.

---

## 8. Constraints finais

- **Não** criar novas colunas em `cobrancas`, `galerias` ou
  `clientes_sessoes`.
- **Não** criar novas RPCs no banco compartilhado — o Gestão apenas
  consome o que já existe.
- **Não** duplicar UI de checkout Asaas dentro do Gestão — Asaas
  transparente é responsabilidade do Gallery.
- Toda cobrança de extras deve, obrigatoriamente, passar por
  `gallery-create-payment`. Se algum fluxo do Gestão precisa criar
  cobrança extra sem passar por aí (ex.: importação de legado), abrir
  discussão antes de implementar.
