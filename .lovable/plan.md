# Galeria reativada cobra extras já pagas — causa raiz e correção

## Diagnóstico (validado no banco da galeria afetada)

**Galeria `ab834051-…`** (Teste, 8 selecionadas, 1 incluída, 7 extras).
**Cobrança paga (1º ciclo)**: R$ 5,00 InfinitePay (`c86be48b`), `qtd_fotos = 0`, `extras_contabilizados = false`.
**Galeria após reativação**: `total_fotos_extras_vendidas = 0`, `valor_total_vendido = 0`, `valor_extras = 5`.

### Por que acontece
O webhook InfinitePay original gravou a cobrança com `qtd_fotos=0` e nunca chamou `finalize_gallery_payment` com sucesso (era a versão antiga, antes do auto-heal). Resultado:

- `total_fotos_extras_vendidas` ficou `0` → não há crédito preservado.
- `valor_total_vendido` ficou `0` → não há valor já pago registrado.

Ao reabrir a galeria, a RPC `reopen_gallery_selection` preserva 0/0 (não havia o que preservar). O `confirm-selection` tem auto-heal, **mas ele só roda quando o cliente reconfirma a seleção** — no painel do fotógrafo (cobrar novamente / registrar recebimento) os números aparecem errados ANTES do cliente abrir a tela de seleção de novo.

Então o painel calcula:
`extrasACobrar = 7 (necess) − 0 (pagas) = 7` → R$ 14,00 (correto: deveria ser 6 extras / R$ 9,00 com a sequência progressiva R$ 2,00/foto a partir da 5ª).

### Por que a sequência progressiva também quebra
`calcularPrecoProgressivoComCredito` usa `totalExtras = extrasPagasTotal + extrasNovas`. Como `extrasPagasTotal=0`, ele entra na faixa errada (vê só 7 novas, calcula 7×R$2 = R$14, sem deduzir os R$5 já pagos). Após o heal, `totalExtras = 1 + 6 = 7`, entra corretamente na faixa "5+" (R$2/foto), aplica desconto e desconta o R$5 pago → **R$ 9,00**.

## Correção (3 frentes)

### 1) Migration — healing automático no momento da reabertura
Atualizar `reopen_gallery_selection` para, **antes** de zerar `valor_extras` e gravar o snapshot de preservação:

```sql
-- Antes do UPDATE galerias da reabertura:
FOR v_c IN
  SELECT id FROM cobrancas
  WHERE galeria_id = p_gallery_id
    AND status IN ('pago','pago_manual')
    AND extras_contabilizados IS NOT TRUE
LOOP
  PERFORM public.finalize_gallery_payment(v_c.id, NULL, NULL, NULL, NULL);
END LOOP;

-- Reler galeria DEPOIS do heal para capturar contadores reais
SELECT * INTO v_g FROM galerias WHERE id = p_gallery_id FOR UPDATE;
```

A `finalize_gallery_payment` já infere `qtd_fotos` quando 0 (via descrição "1 foto extra" ou via `valor / valor_foto_extra`). Após o heal:
- `total_fotos_extras_vendidas` ← soma real (1 no caso da galeria afetada)
- `valor_total_vendido` ← R$ 5,00
- `extras_contabilizados=true` na cobrança histórica.

Em seguida o `UPDATE galerias` da reabertura só zera `valor_extras` (saldo do ciclo) e mantém `total_fotos_extras_vendidas` / `valor_total_vendido` intactos. O comprovante (`ip_receipt_url`) continua acessível porque a cobrança paga não é tocada.

### 2) Migration — backfill da galeria já afetada
Mesma migration, no final, executa o heal pontual para destravar a galeria `ab834051-…` agora (antes do próximo ciclo):

```sql
DO $$
DECLARE v_c uuid;
BEGIN
  FOR v_c IN
    SELECT c.id FROM cobrancas c
    WHERE c.status IN ('pago','pago_manual')
      AND c.extras_contabilizados IS NOT TRUE
      AND c.galeria_id IS NOT NULL
  LOOP
    BEGIN PERFORM public.finalize_gallery_payment(v_c, NULL, NULL, NULL, NULL);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;
```

Isso conserta TODAS as galerias com cobranças pagas órfãs (não só a do teste), de qualquer provedor.

### 3) Defesa adicional na invalidação após reabertura
Em `useSupabaseGalleries.ts > reopenSelectionMutation`: após a RPC, invalidar `['galerias']`, `['galeria-cobrancas-pagas']` e `['galeria-cobranca-pendente']` (algumas já estão; garantir as três). Sem isso o painel pode mostrar valores cacheados.

## Resultado esperado para a galeria do teste

| Antes | Depois |
|---|---|
| Resumo: "+7 extras / Valor a pagar R$ 14,00" | "+7 extras (1 já paga, 6 a pagar) / R$ 9,00" |
| Status do Pagamento: "Pendente R$ 14,00" | "Pendente R$ 9,00" (ou nenhum, se ainda não houver nova cobrança) |
| Comprovante R$ 5,00 visível | Continua visível (cobrança histórica intacta) |
| Tela do cliente "Valor a pagar agora R$ 14,00" | "Valor a pagar agora R$ 9,00" |

A sequência progressiva (R$5 → R$3 → R$2) volta a funcionar entre ciclos porque `totalExtras` agora reflete o histórico real.

## Garantias / não-regressão

- **InfinitePay create-link e webhook NÃO são alterados** — só DB.
- O contrato com Gestão (`clientes_sessoes`) continua sincronizado dentro da mesma RPC.
- Trigger `tg_protect_no_overcharge` permanece ativo; após heal correto ele não bloqueia (R$5 + R$9 = R$14 ≤ teto progressivo).
- Idempotência: `finalize_gallery_payment` já tem advisory lock + `extras_contabilizados`, é seguro chamar múltiplas vezes.
- Galerias sem cobranças órfãs não sofrem mudança.

## Arquivos

- `supabase/migrations/<novo>.sql` — atualiza `reopen_gallery_selection` + backfill DO block.
- `src/hooks/useSupabaseGalleries.ts` — garantir invalidações pós-RPC (ajuste mínimo).

Nenhum outro arquivo precisa mudar — UI já consome `extrasPagasTotal` / `extrasACobrar` / `valorJaPago` corretamente; bastam os números corretos no banco.
