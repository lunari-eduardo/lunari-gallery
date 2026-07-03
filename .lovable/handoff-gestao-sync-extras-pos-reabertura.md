# Handoff Gestão — Sincronização de Extras Pós-Reabertura de Galeria

> Complementa `handoff-gestao-charge-extras-workflow.md`. Ambos devem
> ser lidos juntos. Este documento resolve o bug em que o Gestão exibe
> valor pendente incorreto (ex.: R$ 20,00) enquanto o Gallery calcula
> corretamente (ex.: R$ 2,00) após reabertura de seleção.

---

## 1. Diagnóstico do bug

### Cenário observado
- Cliente pagou fotos extras (ciclo 1).
- Fotógrafo reabriu a galeria via `reopen_gallery_selection`.
- Cliente selecionou fotos novamente (ciclo 2).
- **Gallery** exibe corretamente **R$ 2,00** pendentes.
- **Gestão** exibe **R$ 20,00** pendentes (valor errado).

### Causa raiz
O Gestão está **reimplementando o cálculo** localmente, tipicamente com
uma fórmula ingênua do tipo:

```ts
// ERRADO — não use no Gestão
const extras = fotos_selecionadas - fotos_incluidas;
const pendente = extras * valor_foto_extra;
```

Isso ignora todos estes fatores que só o Gallery conhece:

1. **Ciclos anteriores pagos** (`galerias_sessao_historico`) — o valor
   pago no ciclo 1 já foi absorvido e não conta como "extras a cobrar".
2. **Preço progressivo congelado** (`regras_congeladas.precificacaoFotoExtra`) —
   Gallery pode aplicar R$ 1,00/foto na faixa 4-7 enquanto o Gestão
   assume o bruto R$ 5,00 do pacote.
3. **`venda_tipo_cobranca`** (`only_extras` vs `all_selected`) — muda
   completamente a base do cálculo.
4. **`payment_needs_regeneration`** — cobrança pode estar expirada e
   precisa reemissão, não é "pendente novo".
5. **`extras_contabilizados`** — Gallery marca este flag ao final do
   `finalize_gallery_payment` para evitar dupla contagem.

### Fonte única da verdade
O Postgres já tem a RPC canônica **`calculate_gallery_extra_payment(p_gallery_id uuid)`**
que retorna:

```jsonc
{
  "valor_a_cobrar":        2.00,   // ← PENDENTE real
  "valor_pago":            18.00,  // ← Já pago (todos os ciclos)
  "valor_total_ideal":     20.00,  // ← Total absoluto correto
  "extras_a_cobrar":       2,      // ← qtd fotos a cobrar
  "extras_total":          20,     // ← qtd total já selecionada
  "valor_unitario":        1.00,   // ← preço aplicado (progressivo)
  "rules_source":          "regras_congeladas",
  "is_fully_paid":         false,
  "payment_needs_regeneration": false,
  "ciclo_atual":           2
}
```

**Toda leitura de valor de extras no Gestão DEVE vir dessa RPC.** Não
existe caminho alternativo válido.

---

## 2. Contrato obrigatório para o Gestão

### 2.1 Substituir todos os cálculos locais

Auditar o repositório do Gestão e remover qualquer ocorrência de:

```ts
(fotos_selecionadas - fotos_incluidas) * valor_foto_extra
fotos_selecionadas * valor_foto_extra
SUM(cobrancas.valor WHERE finalidade='fotos_extras' AND status='pago')  // para deduzir pendente
```

Substituir por:

```ts
const { data: calc } = await supabase.rpc(
  'calculate_gallery_extra_payment',
  { p_gallery_id: galeriaId }
);
```

Mapeamento de campos no UI:

| UI Gestão                           | Campo RPC                                   |
| ----------------------------------- | ------------------------------------------- |
| "Extras — Pendente"                 | `calc.valor_a_cobrar`                       |
| "Extras — Já pago"                  | `calc.valor_pago`                           |
| "Extras a cobrar (qtd)"             | `calc.extras_a_cobrar`                      |
| Botão "Cobrar extras" habilitado    | `!calc.is_fully_paid && calc.valor_a_cobrar > 0` |
| Badge "Ciclo N reaberto"            | `calc.ciclo_atual > 1 && status_selecao='em_selecao'` |
| Badge "Cobrança expirada"           | `calc.payment_needs_regeneration === true`  |

### 2.2 Hook único e cacheado

Criar `useGalleryExtraCalc(galleryId)` no Gestão:

```ts
export function useGalleryExtraCalc(galleryId?: string) {
  return useQuery({
    queryKey: ['gallery-extra-calc', galleryId],
    enabled: !!galleryId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'calculate_gallery_extra_payment',
        { p_gallery_id: galleryId }
      );
      if (error) throw error;
      return data;
    },
  });
}
```

Este hook é a **única** fonte para valores de extras em toda a UI do
Workflow, CRM, Dashboard, cards de sessão, tooltips e modais.

### 2.3 Realtime para invalidar o cache

Para cada galeria visível na tela, subscrever a `cobrancas` e
`galerias` filtradas por `galeria_id` e invalidar o queryKey acima:

```ts
useEffect(() => {
  if (!galleryId) return;
  const ch = supabase
    .channel(`gallery-extra-calc-${galleryId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'cobrancas', filter: `galeria_id=eq.${galleryId}` },
      () => queryClient.invalidateQueries({ queryKey: ['gallery-extra-calc', galleryId] })
    )
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'galerias', filter: `id=eq.${galleryId}` },
      () => queryClient.invalidateQueries({ queryKey: ['gallery-extra-calc', galleryId] })
    )
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}, [galleryId]);
```

Segue padrão da memory `realtime-payment-synchronization`.

### 2.4 View SQL para agregações (Dashboard)

Para KPIs agregados (ex.: "total pendente em extras" no Dashboard), o
Gestão pode consumir uma view auxiliar. Se ainda não existir, criar no
banco compartilhado (uma vez, alinhado com o Gallery):

```sql
CREATE OR REPLACE VIEW public.v_gallery_extra_pending AS
SELECT
  g.id                  AS galeria_id,
  g.user_id,
  g.session_id,
  (calculate_gallery_extra_payment(g.id)->>'valor_a_cobrar')::numeric AS valor_a_cobrar,
  (calculate_gallery_extra_payment(g.id)->>'valor_pago')::numeric     AS valor_pago,
  (calculate_gallery_extra_payment(g.id)->>'is_fully_paid')::boolean  AS is_fully_paid
FROM public.galerias g
WHERE g.status_selecao IN ('em_selecao','selecao_completa');
```

> A criação da view exige coordenação — não criar sem alinhar com o
> time do Gallery.

---

## 3. Estados visuais adicionais no card do Workflow

Além dos 3 blocos já definidos no `handoff-gestao-charge-extras-workflow.md § 4`:

| Situação                                                                  | Badge/UI                                             |
| ------------------------------------------------------------------------- | ---------------------------------------------------- |
| `is_fully_paid = true`                                                    | Badge verde "Extras quitados"; botão cobrar desabilitado |
| `status_pagamento IN ('pendente','aguardando_confirmacao')` + cobrança viva | Badge amarelo "Aguardando pagamento"                 |
| `payment_needs_regeneration = true`                                       | Badge laranja "Cobrança expirada — reemitir"          |
| `ciclo_atual > 1 && status_selecao='em_selecao'`                          | Badge azul "Ciclo N reaberto"                        |
| `calc.valor_a_cobrar > 0 && !fully_paid`                                  | Botão "Cobrar extras" ativo (vide handoff anterior)  |

---

## 4. Regras anti-duplicação (o que NÃO fazer)

- **Não** recalcular preço com `valor_foto_extra` em nenhum lugar.
- **Não** somar `cobrancas` no cliente para inferir "quanto já foi
  pago em extras" — use `calc.valor_pago`.
- **Não** persistir `valor_extras_pendente` em `clientes_sessoes` ou
  qualquer tabela — é sempre derivado, nunca armazenado.
- **Não** criar uma RPC nova no banco. `calculate_gallery_extra_payment`
  é a única.
- **Não** duplicar lógica de ciclos lendo `galerias_sessao_historico`
  diretamente para calcular pendente — a RPC já faz.
- **Não** confundir "pendente da sessão" (pacote) com "pendente de
  extras" — são finalidades independentes (§ 3 do handoff anterior).

---

## 5. Como o Gallery já informa o Gestão

O Gallery **não precisa** publicar eventos custom para o Gestão. Todos
os canais de sincronização já existem:

1. **`finalize_gallery_payment` (RPC atômica)** — ao confirmar
   pagamento, atualiza em uma única transação:
   - `cobrancas.status`
   - `galerias.status_selecao`, `status_pagamento`, `extras_contabilizados`
   - `clientes_sessoes.valor_pago`, `status_pagamento`
   - (memory `finalize-gallery-payment-atomic-sync`)
2. **`reopen_gallery_selection` (RPC)** — ao reabrir, insere em
   `galerias_sessao_historico`, reseta flags e incrementa `ciclo_atual`.
3. **Realtime nativo do Supabase** — Gestão subscreve `cobrancas` e
   `galerias` e recebe o UPDATE em <1s.
4. **RPC canônica `calculate_gallery_extra_payment`** — consome todos os
   itens acima e retorna o valor certo em qualquer momento.

**Ação do Gallery:** nada. O contrato já está completo. Toda correção
é no Gestão.

---

## 6. Checklist de implementação (Gestão)

- [ ] Auditar código do Gestão e remover **todos** os cálculos locais
      de extras.
- [ ] Criar `useGalleryExtraCalc(galleryId)` com React Query.
- [ ] Substituir leituras nos cards de Workflow, CRM, Dashboard,
      modais de cobrança e tooltips.
- [ ] Adicionar Realtime channel por galeria visível.
- [ ] Implementar as 4 novas badges visuais (§ 3).
- [ ] Regressão: cenário do bug (pago → reaberto → 2 fotos novas) deve
      exibir exatamente `valor_a_cobrar` da RPC.
- [ ] Regressão: cobrança de extras cria via `gallery-create-payment`
      e o card atualiza sozinho via Realtime.
- [ ] Dashboard: se agregar totais, usar `v_gallery_extra_pending` (ou
      loop com a RPC), nunca fórmulas locais.

---

## 7. Casos de teste específicos deste handoff

1. **Reabertura básica** — Ciclo 1 pago (R$ 18), reabre, cliente
   seleciona +2 fotos. Gallery mostra R$ 2. Gestão deve mostrar R$ 2
   (não R$ 20).
2. **Reabertura com faixa progressiva** — Cliente estava na faixa 4-7
   (R$ 1,00/foto), reabre e passa para faixa 8+ (R$ 0,50/foto). Gestão
   deve mostrar preço unitário atualizado vindo de `calc.valor_unitario`.
3. **Cobrança expirada pós-reabertura** — Reabre com cobrança antiga
   pendente → `payment_needs_regeneration=true` → Gestão mostra badge
   "Cobrança expirada" e botão "Cobrar extras" reemite via
   `gallery-create-payment` (que cancela a antiga automaticamente).
4. **Realtime cross-project** — Cliente paga na galeria pública →
   Gestão (aberto em outra aba) reflete `is_fully_paid=true` em <2s
   sem F5.
5. **Múltiplos ciclos** — 3 ciclos, cada um pago; ciclo 4 aberto.
   `calc.valor_pago` soma tudo, `calc.valor_a_cobrar` só o novo saldo.

---

## 8. Referências

- `.lovable/handoff-gestao-charge-extras-workflow.md` — modal e fluxo
  de criação de cobrança (pré-requisito).
- `.lovable/gallery-rules.md` — R4 (finalidade) e R7 (reabertura).
- `.lovable/handoff-gestao-extras.md` — contrato de finalidade.
- Memory `finalize-gallery-payment-atomic-sync`.
- Memory `reopened-gallery-credit-display`.
- Memory `realtime-payment-synchronization`.
- Memory `progressive-pricing-logic`.
- RPC `calculate_gallery_extra_payment` (Postgres).
- RPC `reopen_gallery_selection` (Postgres).
