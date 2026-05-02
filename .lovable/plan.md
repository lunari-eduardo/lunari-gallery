## Diagnóstico

**Galeria afetada:** `Lorena - 9 meses` (`edfa1c5c-…`)  
**Sessão:** `workflow-1771081690976-x5fdrwzkz9j`

**Estado real (uma cobrança paga manual):**
- `cobrancas`: 1 registro, `qtd_fotos=4`, `valor=92`, `extras_contabilizados=true`, `pago_manual` ✅
- `clientes_transacoes`: 1 lançamento de R$ 92 ✅
- `galerias`: `total_fotos_extras_vendidas=8`, `valor_total_vendido=184` ❌ (dobrado)
- `clientes_sessoes`: `qtd_fotos_extra=8`, `valor_total_foto_extra=184` ❌ (dobrado, propagado pelo trigger `sync_gallery_extras_to_session`)
- UI exibe "Fotos extras totais +8 / Extras já pagas −8 / Valor R$ 23 / Total R$ 184"

**Causa raiz — múltiplos pontos somando os mesmos extras:**

Existem **três caminhos** que mutam `galerias.total_fotos_extras_vendidas` / `valor_total_vendido`, todos não-idempotentes entre si:

1. `confirm-selection` (Edge) linha 770-776: incrementa `gallery + extrasACobrar` (somente para visitante público hoje, mas `set_session_extras` aplica valor ABSOLUTO `gallery + extras` direto na sessão).
2. `finalize_gallery_payment` (RPC, Branches 1/2/3): incrementa `gallery + cobranca.qtd_fotos` quando `extras_contabilizados IS NOT TRUE`.
3. `sync_gallery_extras_to_session` (trigger): copia `gallery.total_fotos_extras_vendidas` e `valor_total_vendido` para a sessão e patcha `regras_congeladas->'pacote'->'valorFotoExtraEfetivo'`.

A galeria foi confirmada em 19/03 (`cliente_confirmou` 4 extras, R$ 92) e o pagamento manual lançado em 02/05. Entre essas datas, um caminho intermediário (provavelmente um reprocessamento manual / reativação / refresh da galeria ou o próprio `confirm-selection` quando rodou em modo Lunari Studio com `set_session_extras` absoluto somando a sessão a um total de galeria já parcialmente preenchido) gravou os 4/92 em `galerias`. Depois, `finalize_gallery_payment` rodou Branch 3 (`v_should_count=true`, pois `extras_contabilizados=false`) e somou +4/+92 de novo — resultando em 8/184. O trigger replicou para a sessão e o JSONB.

**Por que o `extras_contabilizados` não protegeu:**  
A flag só é setada DENTRO de `finalize_gallery_payment`. O caminho que pré-incrementou (confirm-selection / set_session_extras) não consulta nem atualiza essa flag, então a RPC viu `false` e contou de novo.

---

## Plano de correção

### 1. Tornar `total_fotos_extras_vendidas` agregado por cobrança (única fonte)

Migration:
- Recalcular ambos os campos por GROUP BY:
  ```
  galerias.total_fotos_extras_vendidas = SUM(c.qtd_fotos) WHERE c.galeria_id = g.id AND c.status IN ('pago','pago_manual')
  galerias.valor_total_vendido        = SUM(c.valor)     WHERE c.galeria_id = g.id AND c.status IN ('pago','pago_manual')
  ```
- Marcar todas as cobranças pagas/pago_manual como `extras_contabilizados=true`.
- Reconciliar TODA a base (a divergência da Lorena pode existir em outras galerias).

### 2. `finalize_gallery_payment` — substituir incremento por recompute

Em vez de `COALESCE(total,0) + qtd_fotos`, fazer:
```sql
UPDATE galerias g SET
  total_fotos_extras_vendidas = (SELECT COALESCE(SUM(qtd_fotos),0) FROM cobrancas
                                  WHERE galeria_id=g.id AND status IN ('pago','pago_manual')),
  valor_total_vendido         = (SELECT COALESCE(SUM(valor),0)     FROM cobrancas
                                  WHERE galeria_id=g.id AND status IN ('pago','pago_manual'))
WHERE id = v_galeria_id;
```
Mantém `extras_contabilizados=true` apenas como auditoria. Aplicar nos três Branches (1, 2, 3) da RPC. Isso elimina double-count permanentemente — independente de quantos caminhos chamem.

### 3. `confirm-selection` — parar de mexer em `total_fotos_extras_vendidas`

- Remover o `UPDATE galerias SET total_fotos_extras_vendidas = + extrasACobrar` (linha 770-776) — o pagamento confirma o conteúdo.
- `valor_extras` (espelho do ciclo atual) pode ficar.
- `set_session_extras`: passar a usar **somente os valores já consolidados da galeria** (recompute via SUM de `cobrancas`), não somar `+ extrasACobrar`. Para a UI mostrar "valor a pagar" antes do pagamento, usar campos derivados (não persistir como pago).

### 4. Trigger `sync_gallery_extras_to_session`

Já está bem desenhada (copia da galeria → sessão). Após (1)+(2), os valores na galeria serão sempre corretos, então o trigger fica seguro.

### 5. Idempotência das cobranças manuais

Adicionar **índice único parcial** para evitar lançamento duplicado pelo botão "Confirmar pagamento manual":
```sql
CREATE UNIQUE INDEX cobrancas_manual_dedup_idx
ON cobrancas (galeria_id, valor, qtd_fotos, metodo_manual)
WHERE provedor = 'manual' AND status IN ('pago_manual','pendente');
```
Em `confirm-payment-manual` Edge: usar `upsert` com `onConflict` ou pré-checar antes de `insert`, retornando a cobrança existente.

### 6. Reconciliação imediata da Lorena

Migration corretiva:
```sql
UPDATE galerias SET total_fotos_extras_vendidas=4, valor_total_vendido=92
WHERE id='edfa1c5c-d17c-4386-ae02-d6ac53d2e86e';
-- trigger sync_gallery_extras_to_session propaga para sessão e regras_congeladas
```

### 7. Testes de regressão

- Galeria standalone: cliente confirma 4 extras → paga via InfinitePay → verificar `total_fotos_extras_vendidas=4`.
- Galeria Lunari Studio: cliente confirma 4 extras → fotógrafo lança pagamento manual → verificar 4 (não 8).
- Reativação após pago: cliente seleciona +2 → paga → verificar 6 (acumulado correto).
- Idempotência: clicar 2× no botão "Confirmar manual" → 1 cobrança apenas.

---

## Arquivos impactados

- **Nova migration**: recompute global + reconciliação Lorena + índice único + redefinição da RPC.
- `supabase/functions/confirm-selection/index.ts`: remover incremento direto + ajustar `set_session_extras`.
- `supabase/functions/confirm-payment-manual/index.ts`: dedup antes do insert.
- `set_session_extras` RPC: aceitar recompute em vez de absolutos calculados pelo cliente (ou ser substituída por chamada ao `finalize_gallery_payment` no fluxo de "venda sem pagamento exigido").

InfinitePay (`infinitepay-create-link`, `infinitepay-webhook`) **não** precisam mudar — o webhook continua chamando `finalize_gallery_payment`, que após (2) será naturalmente idempotente.

---

## Riscos & mitigações

- **Risco**: galerias antigas podem ter `cobrancas.qtd_fotos=0` (regressão histórica). A RPC já tem inferência defensiva (regex + valor/preço unitário). Manter.
- **Risco**: trigger `protect_session_extras_consistency` força sessão a refletir galeria — após (1)+(2) isso é desejado. Sem mudança.
- **Risco**: cobranças Asaas com parcelas — Branch 2 também passa a usar SUM, mas só conta quando `current_status='pago'`. Sem regressão.

Após aprovação, implemento na ordem: migration (1+6+índice) → RPC (2) → confirm-selection (3) → confirm-payment-manual (5) → testes.