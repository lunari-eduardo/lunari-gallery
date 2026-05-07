## Correção da causa raiz

### O que está acontecendo (validado no banco da galeria de teste)

Galeria `9b90dbb7-…`: `fotos_selecionadas=5`, `fotos_incluidas=1` → **4 extras reais selecionados** (UI da galeria mostra corretamente).

| Cobrança | Provedor | Valor | qtd_fotos | status |
|---|---|---|---|---|
| `ec2a02d4` | Asaas | R$ 10 | **2** | pago |
| `486895ac` | manual | R$ 2 | **0** (não enviado) | pago_manual |

Galeria fica com `total_fotos_extras_vendidas = SUM(qtd_fotos pagos) = 2` e `valor_total_vendido = 12`. A trigger `sync_gallery_extras_to_session` propaga `qtd_fotos_extra = 2` para `clientes_sessoes` → card do workflow no Gestão mostra **2 extras** em vez de **4**.

### Onde está o erro de contrato

A `finalize_gallery_payment` faz `qtd_fotos_extra = SUM(cobrancas.qtd_fotos pagos)`, e a `sync_gallery_extras_to_session` propaga isso para a sessão. Isso confunde dois conceitos diferentes:

- **Quantidade de extras** = característica da seleção do cliente (`fotos_selecionadas − fotos_incluidas`). Pagamento manual **não deve influenciar isso**.
- **Valor pago / status** = característica financeira. Sim, reflete soma das cobranças pagas.

Como o pagamento manual não enviou `qtd_fotos`, o agregado ficou subnotificado e quebrou o card. A regra correta é: **a quantidade de extras nunca deriva de cobranças**; deriva da seleção da galeria.

## Plano de correção (cirúrgico)

### 1) Migration — corrigir fonte de verdade nas RPCs/triggers

**A) `finalize_gallery_payment`**: trocar a fórmula de `total_fotos_extras_vendidas` em todos os 3 branches:

```sql
-- Antes:
SELECT COALESCE(SUM(qtd_fotos), 0)::int, COALESCE(SUM(valor), 0)::numeric
INTO v_sum_qtd, v_sum_val
FROM cobrancas WHERE galeria_id = v_galeria_id AND status IN ('pago','pago_manual') ...

-- Depois:
SELECT GREATEST(COALESCE(fotos_selecionadas,0) - COALESCE(fotos_incluidas,0), 0)
INTO v_sum_qtd FROM galerias WHERE id = v_galeria_id;
SELECT COALESCE(SUM(valor),0) INTO v_sum_val FROM cobrancas
  WHERE galeria_id = v_galeria_id AND status IN ('pago','pago_manual') AND tipo_cobranca IN (...);
```

`valor_total_vendido` continua sendo soma dos pagos (financeiro). `total_fotos_extras_vendidas` passa a refletir a seleção real.

**B) `sync_gallery_extras_to_session`**: ao recalcular `v_unit_efetivo`, usar `qtd_pagos` apenas para o cálculo do unitário (preço médio efetivo do que foi cobrado), mas propagar `s.qtd_fotos_extra = total_fotos_extras_vendidas` (que agora vem da seleção). Fica:

```sql
v_qtd_pagos := (SELECT COALESCE(SUM(qtd_fotos),0) FROM cobrancas
                WHERE galeria_id = NEW.id AND status IN ('pago','pago_manual'));
v_unit_efetivo := CASE WHEN v_qtd_pagos > 0 AND NEW.valor_total_vendido > 0
                       THEN ROUND(NEW.valor_total_vendido / v_qtd_pagos, 2)
                       ELSE v_unit_base END;
-- propaga NEW.total_fotos_extras_vendidas (= extras selecionados) para s.qtd_fotos_extra
```

**C) `protect_gallery_extras_downgrade`**: ajustar exceção para não bloquear quando a queda decorre de mudança em `fotos_selecionadas` legítima (já existe lógica via `confirm-selection`; basta permitir `total_fotos_extras_vendidas` igualar a `fotos_selecionadas - fotos_incluidas` mesmo se for menor que o anterior).

**D) `reconcile_gallery_extras_counters`**: mesma troca da fonte de `qtd_fotos_extra`.

### 2) Backfill da galeria afetada (mesma migration)

DO block: para cada galeria com cobrança paga e `total_fotos_extras_vendidas <> fotos_selecionadas - fotos_incluidas`, atualizar para a seleção real e reexecutar `reconcile_gallery_extras_counters()`.

### 3) Edge function `confirm-payment-manual` — defesa adicional (opcional, mas recomendada)

Continuar gravando `qtd_fotos = 0` para manuais (não inferir do valor); a fonte de verdade passa a ser sempre a seleção. Adicionar comentário explícito no código documentando a decisão. Sem mudança de contrato externo.

### 4) Lado Gestão (`Lunari_gestão`) — nada a alterar

`useWorkflowPackageData` e `useAppointmentWorkflowInfo` leem `clientes_sessoes.qtd_fotos_extra`. A trigger `sync_gallery_extras_to_session` já propaga; basta a fonte estar correta. Realtime (`useSessionsRealtime`/`useWorkflowRealtime`) atualiza o card automaticamente.

## Resultado esperado para a galeria do teste

| | Antes | Depois |
|---|---|---|
| `galerias.total_fotos_extras_vendidas` | 2 | **4** |
| `galerias.valor_total_vendido` | 12 | 12 (inalterado) |
| `clientes_sessoes.qtd_fotos_extra` | 2 | **4** |
| `clientes_sessoes.valor_foto_extra` (unit efetivo) | 6,00 | 3,00 (12 / 4) |
| Card workflow Gestão | "2 extras" | **"4 extras"** |

## Garantias / não-regressão

- **InfinitePay e Asaas (create-link, webhooks)**: zero alteração — continuam gravando `qtd_fotos` próprio.
- `tg_protect_no_overcharge`: continua válido (limita pelo valor unitário × extras, não pela contagem de pagos).
- Idempotência de `finalize_gallery_payment`: mantida (advisory lock + flag).
- Galerias finalizadas integralmente (qtd_fotos pagos = extras selecionados) ficam idênticas após o backfill.
- Pagamento manual passa a fazer só o que diz o nome: atualiza status financeiro, não interfere na contagem de extras.

## Arquivos

- `supabase/migrations/<novo>.sql` — atualiza `finalize_gallery_payment`, `sync_gallery_extras_to_session`, `protect_gallery_extras_downgrade`, `reconcile_gallery_extras_counters` + DO block backfill + chamada `reconcile_gallery_extras_counters()`.
- `supabase/functions/confirm-payment-manual/index.ts` — comentário de contrato (sem mudança funcional).

Nenhuma outra alteração necessária.
