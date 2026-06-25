# Handoff Gallery → Gestão: contrato canônico de cobrança de fotos extras

> Cole este arquivo no chat do projeto **Lunari_Gestão** (Lovable). Ele descreve **o que o Gallery acabou de mudar no banco compartilhado** e **o que o Gestão precisa ajustar** para que sessão e galeria sempre batam.

---

## 1. Contexto — bug que motivou esta onda

**Galeria Clarissa Machado** (`523640bd-1ba2-456a-93d2-a16b8eaf11f2`, sessão `workflow-1781641629524-pzxoid8zxnn`):

- Cliente selecionou 15 fotos (10 incluídas + 5 extras).
- Regra congelada do pacote: faixa **4–7 extras = R$ 23/foto** → ideal **R$ 115,00**.
- Pelo fluxo do Gestão (ChargeModal/InfinitePay), foi gerada uma cobrança de **R$ 125,00** (5 × R$ 25 fixo). O cliente pagou.
- Resultado caótico:
  - A cobrança foi gravada com `finalidade='sessao'` e `galeria_id=NULL`.
  - A sessão ficou marcada como `valor_pago = R$ 535` (310 + 100 + 125) num total de R$ 535 → "paga", mas com os extras misturados na receita da sessão.
  - A galeria nunca foi marcada como paga, ficou em `aguardando_pagamento`.
  - Houve **sobrecobrança de R$ 10** em cima do cliente.

Healing já aplicado no banco (DO block na migration desta onda) — Clarissa hoje está:
- Cobrança: `finalidade=fotos_extras`, vinculada à galeria, 5 fotos.
- Transação financeira **sem** `session_id` (a receita pertence à galeria, não à sessão).
- Galeria: `pago`, `selecao_completa`, 5 extras vendidas, R$ 125 vendidos.
- Sessão: `valor_total=R$ 410`, `valor_pago=R$ 410`, `status_pagamento_fotos_extra=pago`.
- `audit_log.extras_overpayment_detected` registrando os R$ 10 a estornar/manter como crédito.

---

## 2. O que o Gallery mudou no banco (já em produção)

### 2.1 Nova RPC canônica — **use esta como fonte única de verdade**

```sql
public.calculate_gallery_extra_payment(p_gallery_id uuid) RETURNS jsonb
```

Retorna:
```json
{
  "success": true,
  "gallery_id": "...",
  "user_id": "...",
  "session_id": "...",
  "selected_count": 15,
  "included_count": 10,
  "extras_necessarias": 5,
  "extras_pagas": 5,
  "valor_pago": 125,
  "valor_unitario": 23,
  "valor_total_ideal": 115,
  "valor_a_cobrar": 0,
  "rules_source": "gallery_frozen"   // ou session_frozen / gallery_fixed
}
```

A RPC **sempre** respeita a faixa progressiva congelada (categoria/global/fixo) — exatamente como o Gallery calcula no `confirm-selection`. Não duplique a lógica.

### 2.2 Endurecimento de `tg_protect_no_overcharge`

O gatilho que protege contra cobrança acima do devido **agora usa `calculate_gallery_extra_payment`**. Qualquer INSERT/UPDATE em `cobrancas` com `finalidade='fotos_extras'` e `galeria_id` falhará com erro explícito se ultrapassar o ideal pela regra congelada (tolerância 1 centavo).

Mensagem do erro:
```
Cobrança excederia o saldo devido pela regra congelada. Já pago=R$X, nova=R$Y, máximo permitido=R$Z (fonte: gallery_frozen)
```

### 2.3 Endurecimento de `finalize_gallery_payment`

A RPC **deixou de adivinhar galeria por `session_id`**. Ela só sincroniza galeria quando a cobrança já vem com `finalidade='fotos_extras'` E `galeria_id IS NOT NULL`.

Consequência: se o Gestão criar a cobrança "como sessão", **a galeria nunca será marcada como paga, mesmo se o `session_id` coincidir**. Isso é intencional — força o Gestão a sempre declarar `finalidade` corretamente.

---

## 3. O que o Gestão precisa implementar agora

### 3.1 ChargeModal — selecionar finalidade explicitamente

No `src/components/cobranca/ChargeModal.tsx` (e qualquer outro ponto que monta payload de cobrança):

- Adicionar selector **"Finalidade da cobrança"**:
  - `sessao` — cobrança vinculada à sessão (pacote, parcela, adicional avulso).
  - `fotos_extras` — cobrança vinculada a uma galeria específica.
- Se o usuário escolher `fotos_extras`:
  - Mostrar combobox para escolher a **galeria** (lista as galerias da sessão).
  - Mostrar input de **quantidade de fotos extras**.
  - **Calcular valor consultando a RPC**:
    ```ts
    const { data } = await supabase.rpc('calculate_gallery_extra_payment', {
      p_gallery_id: galleryId
    });
    const valorSugerido = data.valor_a_cobrar; // já desconta o que está pago
    ```
  - Pré-preencher o input de valor com `valor_a_cobrar` e **bloquear submit** se o usuário tentar enviar acima do ideal (mostrando a justificativa: "Regra congelada: 5 × R$ 23 = R$ 115. Já pago: R$ 0. Máximo: R$ 115").

### 3.2 Edge functions de cobrança (Gestão)

Todas as edge functions do Gestão que fazem `INSERT INTO cobrancas` **precisam aceitar e persistir**:

| Coluna | Quando `sessao` | Quando `fotos_extras` |
|---|---|---|
| `finalidade` | `'sessao'` | `'fotos_extras'` |
| `session_id` | preenchido | **opcional** (não obrigatório) |
| `galeria_id` | `NULL` | obrigatório |
| `qtd_fotos` | `NULL` | obrigatório, > 0 |
| `snapshot_fotos_incluidas` | `NULL` | obrigatório (snapshot de `galerias.fotos_incluidas` no momento da cobrança) |
| `correlation_id` | livre | livre, recomendado |

Funções a auditar no Gestão (lista provável):
- `gestao-infinitepay-create-link`
- `gestao-mercadopago-create-link`
- `gestao-asaas-create-payment` / `gestao-asaas-create-subscription`
- `confirm-payment-manual`
- Qualquer webhook que faça INSERT em `cobrancas`

**Validação server-side obrigatória** (já existe `_shared/cobrancaBinding.ts` da onda anterior — reaproveitar):
- Se `finalidade === 'fotos_extras'`:
  - Validar `galeria_id` (existe, pertence ao mesmo `user_id`).
  - Validar `qtdFotos > 0`.
  - **Consultar a RPC `calculate_gallery_extra_payment`** e rejeitar (HTTP 400) com código `EXTRA_PAYMENT_EXCEEDS_IDEAL` se o valor solicitado for maior que `valor_a_cobrar + 0.01`.
- Caso contrário, garantir `galeria_id=NULL` e `qtd_fotos=NULL` (não deixar vazar).

### 3.3 Transações financeiras — separar receita de extras da receita da sessão

**Regra do contrato**: receita de fotos extras pertence à **galeria**, não à sessão.

Quando a edge function do Gestão registrar em `clientes_transacoes` a transação de uma cobrança:
- Se `cobranca.finalidade === 'fotos_extras'` → **NÃO** preencher `session_id`. A transação fica apenas com `cobranca_id`.
- Se `cobranca.finalidade === 'sessao'` → preencher `session_id` normalmente.

Isso evita que o `recompute_session_paid` infle o `valor_pago` da sessão com dinheiro que pertence à galeria — foi exatamente a fonte do "valor pago 535" da Clarissa.

### 3.4 Workflow — leitura segregada

Na página `Workflow` (e qualquer hook tipo `useSessionFinancials`):

1. **Bloco "Pagamentos da sessão"** — somar apenas:
   ```sql
   SELECT COALESCE(SUM(valor), 0) FROM cobrancas
    WHERE session_id = :sid
      AND finalidade = 'sessao'
      AND status IN ('pago','pago_manual')
   ```
2. **Bloco "Fotos extras"** — para cada galeria da sessão, chamar `calculate_gallery_extra_payment(galeria.id)` e exibir:
   - Selecionadas / incluídas / extras necessárias
   - Valor unitário aplicado (com origem: regra congelada vs fixo)
   - Total ideal × total pago × saldo (`valor_a_cobrar`)
3. **Nunca** somar `clientes_sessoes.valor_total_foto_extra` na "receita da sessão". Esse campo, no contrato novo, é considerado **derivado** e o Gallery o mantém em `0` quando a galeria foi paga.

### 3.5 Blindagem contra cobranças órfãs (sem painel manual)

**Decisão de produto**: NÃO haverá painel admin de reconciliação. O sistema precisa impedir que cobranças órfãs sejam criadas — qualquer correção manual é sintoma de falha do contrato.

Para isso, o Gestão deve garantir, no ChargeModal e em todas as edge functions de cobrança:

1. **Bloqueio dura no servidor**: se a sessão tiver galeria associada COM extras pendentes (`fotos_selecionadas > fotos_incluidas` e `status_pagamento != 'pago'`), o backend deve **rejeitar** qualquer cobrança com `finalidade='sessao'` cujo valor coincida (±1%) com o saldo de extras. Mensagem: `AMBIGUOUS_PURPOSE_USE_FOTOS_EXTRAS`.
2. **Sugestão proativa no ChargeModal**: ao abrir o modal para uma sessão com extras pendentes, mostrar banner "Esta sessão tem R$ X em fotos extras pendentes na galeria Y — deseja cobrar como fotos extras?" com CTA que já pré-seleciona `finalidade=fotos_extras` + galeria + qtd.
3. **Healing legado**: o Gallery já corrigiu Clarissa via migration. Casos legados restantes devem ser tratados via SQL pontual pela equipe (não via UI). Query para listar candidatos:
```sql
SELECT c.id, c.session_id, c.valor, c.data_pagamento, g.id as galeria_id
  FROM cobrancas c
  JOIN galerias g ON g.session_id = c.session_id
 WHERE c.finalidade = 'sessao' AND c.galeria_id IS NULL
   AND c.status IN ('pago','pago_manual')
   AND g.fotos_selecionadas > g.fotos_incluidas
   AND c.created_at >= g.created_at;
```
Para cada caso: `SELECT public.claim_orphan_payment_for_gallery(:cobranca_id, :galeria_id, :qtd_fotos);`

---

## 4. Casos de teste obrigatórios após a implementação

1. **Sessão padrão**: criar cobrança de pacote pelo ChargeModal → `cobrancas.finalidade='sessao'`, `galeria_id=NULL`. Pagamento entra como receita da sessão.
2. **Extras manuais (Gestão)**: ChargeModal → finalidade "fotos extras" → escolher galeria com 5 extras → valor sugerido bate com `calculate_gallery_extra_payment`. Após pagar, galeria vira `selecao_completa`, sessão **não** soma esses R$ na receita.
3. **Tentativa de sobrecobrança**: tentar criar cobrança de R$ 200 para uma galeria cujo ideal é R$ 115 → `tg_protect_no_overcharge` rejeita com erro explícito.
4. **Fluxo público Gallery permanece igual**: cliente seleciona pela galeria pública → cobrança criada já com `finalidade='fotos_extras'` e tudo correto.
5. **Reclassificação de cobrança órfã legada**: rodar a query da seção 3.5, escolher um candidato, chamar `claim_orphan_payment_for_gallery` → galeria fica paga, sessão é recalculada sem contar esse valor.

---

## 5. Constraints

- **Não** crie novas colunas em `cobrancas` / `galerias` / `clientes_sessoes` — o contrato cabe nas colunas existentes (`finalidade`, `galeria_id`, `qtd_fotos`, `snapshot_fotos_incluidas`, `correlation_id`).
- **Não** modifique funções/triggers do Gallery (`finalize_gallery_payment`, `tg_protect_no_overcharge`, `calculate_gallery_extra_payment`). Elas são parte do contrato compartilhado.
- Edge functions do Gestão **devem** continuar usando `fetch` + `SUPABASE_SERVICE_ROLE_KEY` para comunicação entre projetos (nunca SDK `invoke()` cross-project) — padrão já consolidado.
- Toda nova RPC consultada do frontend Gestão precisa estar em `src/integrations/supabase/types.ts` regenerado.

---

## 6. Checklist final

- [ ] ChargeModal: campo `finalidade` (Sessão / Fotos extras).
- [ ] ChargeModal: campo galeria + qtd_fotos quando `fotos_extras`.
- [ ] ChargeModal: pré-cálculo via RPC `calculate_gallery_extra_payment`.
- [ ] Edge functions Gestão: payload aceita e persiste `finalidade`, `galeria_id`, `qtd_fotos`, `snapshot_fotos_incluidas`, `correlation_id`.
- [ ] Edge functions Gestão: validação anti-overcharge via RPC antes do INSERT.
- [ ] Edge functions Gestão: `clientes_transacoes.session_id = NULL` quando a cobrança é `fotos_extras`.
- [ ] Workflow: bloco "receita da sessão" filtra `finalidade='sessao'`.
- [ ] Workflow: bloco "fotos extras" usa RPC canônica.
- [ ] Página de reconciliação para órfãos legados.
- [ ] 5 casos de teste manuais passando.
