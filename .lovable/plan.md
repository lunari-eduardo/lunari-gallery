## Diagnóstico aprofundado

### O que aconteceu (causa raiz)

Investiguei o banco e confirmei o padrão. Existem **7 galerias da campanha "Dia das Mães"** (Leticia, Gabriela, Julia, Paula, Luize, Amanda, Emily) onde:

- A cobrança **InfinitePay foi paga** (status `pago`, `extras_contabilizados = true`).
- Mas a cobrança foi gravada com **`qtd_fotos = 0`**.
- Resultado:
  - `galerias.valor_total_vendido` foi atualizado corretamente (vem de `SUM(valor)`).
  - `galerias.total_fotos_extras_vendidas` ficou em **0** (vem de `SUM(qtd_fotos)`).
  - `clientes_sessoes.qtd_fotos_extra` e `valor_total_foto_extra` ficaram em **0** (no Studio).

Como `total_fotos_extras_vendidas = 0`, o sistema interpreta o valor pago como **"crédito" / saldo positivo** em vez de pagamento de extras vendidas. É exatamente o que aparece no print ("+R$ 50,00", "+R$ 200,00", "+R$ 275,00" como crédito).

### Por que a cobrança ficou com qtd_fotos = 0

A função `infinitepay-create-link` recebe `qtdFotos` no body da requisição. Em algum momento o frontend chamou esta função **sem enviar `qtdFotos`** (ou com `0`). A inferência defensiva (regex na descrição "11 fotos extras…" ou divisão `valor / valor_foto_extra`) **só foi adicionada depois** que essas cobranças foram criadas — por isso elas escaparam.

A descrição de todas as cobranças problemáticas casa o regex `(\d+)\s*foto`:
- "3 fotos extras - Amanda" → 3
- "11 fotos extras - Paula" → 11
- "8 fotos extras - Emily" → 8
- "2 fotos extras - Gabriela" → 2
- "11 fotos extras - Leticia" → 11
- etc.

E `valor / valor_foto_extra` também bate (ex.: 75/25 = 3, 275/25 = 11).

### Por que reconciliação anterior não corrigiu

A migration de 02/05 (`20260502230510`) recalculou `galerias` somando `qtd_fotos`, mas **as cobranças continuavam com `qtd_fotos = 0`**, então a soma deu 0. A migration NÃO refez a inferência de `qtd_fotos` para cobranças antigas, NEM tocou em `clientes_sessoes`.

Total de cobranças InfinitePay pagas com `qtd_fotos = 0` no histórico: **28** (11 com quantidade extraível por regex; outras 17 só por divisão valor/preço).

---

## Plano de correção

### 1. Migration de cura retroativa (one-shot, idempotente)

Em uma única migration:

**1.a — Inferir `qtd_fotos` para cobranças pagas com 0**
Para todas as cobranças `provedor = 'infinitepay'`, `status IN ('pago','pago_manual')`, `tipo_cobranca IN ('foto_extra','link','venda_galeria')`, `COALESCE(qtd_fotos,0) = 0`, `galeria_id IS NOT NULL`, `valor > 0`:

1. Tentar regex `(\d+)\s*foto` na `descricao` → usar match.
2. Se falhar, dividir `valor / galerias.valor_foto_extra` (arredondado), apenas se `valor_foto_extra > 0` e o resultado for inteiro razoável (≤ 999).
3. Atualizar `cobrancas.qtd_fotos` somente quando a inferência for confiável. Logar (via `RAISE NOTICE`) os casos sem inferência possível.

**1.b — Recompute por SUM nas galerias afetadas**
Reaplicar a mesma lógica de SUM da `finalize_gallery_payment` para todas as galerias cujas cobranças foram tocadas em 1.a, atualizando `total_fotos_extras_vendidas`, `valor_total_vendido`, `status_pagamento`, `status_selecao`, `finalized_at`.

**1.c — Propagação para `clientes_sessoes`**
Para cada `session_id` envolvido, aplicar:
```sql
UPDATE clientes_sessoes SET
  qtd_fotos_extra = <sum_qtd>,
  valor_total_foto_extra = <sum_val>,
  status_galeria = 'selecao_completa',
  status_pagamento_fotos_extra = '<status>'
```

### 2. Blindagem na criação da cobrança (definitiva)

Em `supabase/functions/infinitepay-create-link/index.ts`:

- Promover a inferência defensiva atual a **bloqueio crítico**: se após inferência ainda houver `qtdFotos <= 0` para `tipo_cobranca` que afeta extras, **abortar com 400** em vez de gravar `qtd_fotos = 0`.
- Logar com mais clareza (incluir `descricao` e `valor_foto_extra` no warning).

Isso impede que **novas** cobranças InfinitePay (e por simetria, manuais) entrem com `qtd_fotos = 0`.

### 3. Trigger de integridade no banco (defesa em profundidade)

Adicionar um BEFORE INSERT/UPDATE trigger em `cobrancas` que, **somente quando** `status` muda para `pago`/`pago_manual` e `tipo_cobranca IN ('foto_extra','link','venda_galeria')` e `galeria_id IS NOT NULL`:

- Se `qtd_fotos` é 0/null, executa a mesma inferência (regex na descrição, depois `valor / valor_foto_extra`).
- Se ainda assim não consegue, registra na tabela `audit_log` (sem bloquear o pagamento — não queremos perder dinheiro confirmado).

Isso garante que mesmo que algum webhook/edge function futuro escape, o banco corrige antes que `finalize_gallery_payment` rode.

### 4. Job de reconciliação periódica (opcional, recomendado)

Função SQL `reconcile_gallery_extras_counters()` (sem agendamento por enquanto, executável sob demanda) que:
- Detecta divergências entre `SUM(cobrancas.qtd_fotos)` e `galerias.total_fotos_extras_vendidas`.
- Detecta divergências entre `galerias.*` e `clientes_sessoes.*`.
- Corrige e retorna lista do que foi corrigido.

Pode ser exposta no Admin futuramente, mas a função em si já fica disponível.

---

## Detalhes técnicos

**Arquivos a alterar:**
- Nova migration `supabase/migrations/<timestamp>_heal_infinitepay_qtd_fotos.sql` (passos 1, 3 e 4).
- `supabase/functions/infinitepay-create-link/index.ts` (passo 2 — bloqueio quando inferência falha).

**Galerias que serão curadas (confirmadas):**

```text
c837dd6c… Leticia    cobr R$275 → 11 fotos
9d570e17… Gabriela   cobr R$50  →  2 fotos
9c530b9c… Julia      cobr R$75  →  3 fotos
5eef8014… Paula      cobr R$275 → 11 fotos
3b729ddd… Luize      cobr R$25  →  1 foto
5e390ed1… Amanda     cobr R$75  →  3 fotos
8a9f354c… Emily      cobr R$200 →  8 fotos
```
+ até 21 cobranças adicionais que serão tentadas por inferência (logadas para revisão manual se a inferência não for segura).

**Impacto após correção:**
- `galerias.total_fotos_extras_vendidas` ficará correto.
- `clientes_sessoes.qtd_fotos_extra` e `valor_total_foto_extra` refletirão o pago.
- Coluna "Fotos Extras" na tela do Studio passará a mostrar 11, 8, 3, etc. em vez de 0.
- Coluna "Crédito" deixará de exibir o valor das fotos extras como saldo positivo (porque o sistema reconhecerá que é pagamento de extras já vendidas).

**Garantias de não-regressão:**
- Migration usa `WHERE` filtros conservadores e só age onde a inferência é confiável.
- Bloqueio na edge function vale só para cobranças NOVAS — não afeta retentativas/healing existentes.
- Trigger não bloqueia pagamento (apenas tenta corrigir + audita).

Aguardando aprovação para executar.
