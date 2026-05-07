# Galerias reativadas — extras pagos contabilizados de novo (UI completa)

## Confirmação dos pontos do usuário

Investiguei especificamente o que o usuário levantou:

### 1. Painel do fotógrafo (já mapeado antes)
`GalleryDetail.tsx` linha 874 usa fallback `valorTotalVendido` (R$ já pagos) quando `calculatedExtraTotal=0`. Resultado: card "Pendente R$ 50" para crédito que JÁ foi pago.

### 2. Contador do cliente durante seleção (NOVO ponto confirmado)
- **`ClientGalleryHeader.tsx` (linhas 187‑197)** — mostra `+{extraCount} extras`. `extraCount = selectedCount - includedPhotos` inclui as fotos pagas no ciclo anterior, porque `reopenSelection` NÃO desmarca (`is_selected=true` é preservado na DB).
- **`SelectionSummary.tsx` bottom-bar (linhas 78‑87)** — exibe `R$ {displayTotal.toFixed(2)}` que vem de `calcularPrecoProgressivoComCredito`. Esse cálculo já desconta `valorJaPago` corretamente, MAS depende do prop `extrasACobrar`. Se o `ClientGallery.tsx` passar `extrasACobrar` correto (linha 1709 — passa), o valor está certo. **Confirmei: o R$ no bottom-bar mostra apenas o saldo a cobrar.**
- **Problema real**: o "+6 extras" no header dá impressão de que o cliente vai pagar 6 × R$25, quando só 4 são cobráveis. Falta exibir "+2 já pagas" no header.

### 3. Finalização cliente (`SelectionConfirmation.tsx`)
Linhas 214-217 já mostram `+{extrasPagasAnteriormente}` em verde e linhas 221-224 mostram `{extraCount}` total. O cálculo está correto. Falta só evidenciar visualmente que o "Valor total ideal" não é o que será cobrado.

### 4. Backend (verificado, está correto)
- `confirm-selection` linha 423: `extrasACobrar = max(0, extrasNecessarias - extrasPagasTotal)` ✅
- `infinitepay-create-link`: recebe `qtdFotos: extrasACobrar` e cria cobrança apenas do delta ✅
- `finalize_gallery_payment`: usa `SUM` das cobranças pagas, idempotente ✅
- **Cobrança real está correta** — os R$ 100 cobrados eram só os 4 novos.

### Conclusão
**O backend NÃO duplica cobrança.** O cliente NÃO foi cobrado pelas 2 já pagas. Mas a UI em 3 lugares dá a impressão visual de duplicidade — o que é um bug de confiança do produto, igualmente grave.

## Correções

### A. Painel do fotógrafo (`GalleryDetail.tsx`)
1. Remover fallback `valorTotalVendido` no prop `valor` do `PaymentStatusCard` (linhas 874 e 1104). Usar SOMENTE `calculatedExtraTotal`.
2. Esconder o card quando `extrasACobrar === 0 && !cobrancaData`. Substituir condição atual baseada apenas em `statusPagamento`.
3. Sempre exibir `valorJaPago` como "Crédito do ciclo anterior: R$ X" no `PaymentStatusCard` (informativo, não cobrável).

### B. Header do cliente (`ClientGalleryHeader.tsx`)
1. Adicionar prop `extrasPagasAnteriormente?: number`.
2. Quando > 0, exibir badge informativo: `+{extraCount} extras` com tooltip/sub-label `({extrasPagasAnteriormente} já pagas, {extrasACobrar} a pagar)`.
3. Receber a prop de `ClientGallery.tsx` (já existe `extrasPagasTotal` no escopo).

### C. Bottom-bar (`SelectionSummary.tsx` variant=bottom-bar)
1. Quando `extrasPagasTotal > 0`, exibir mini-segmento: `+{totalExtras}` com sub-texto `(−{extrasPagasTotal} já pagas)` em cor secundária.
2. Confirmar que `displayTotal` reflete só o saldo a cobrar (já está, mas adicionar `data-testid` para testes).

### D. Confirmação cliente (`SelectionConfirmation.tsx`)
1. Reordenar exibição: mostrar PRIMEIRO "Valor a pagar agora: R$ {valorACobrar}" em destaque grande.
2. Mover "Valor total ideal" e "Já pago" para uma seção colapsável "Ver detalhes do cálculo".
3. Adicionar texto explicativo: `"Você já pagou R$ {valorJaPago} por {extrasPagasAnteriormente} foto(s) extras anteriormente. Agora pagará apenas o adicional."`

### E. Hook — `reopenSelectionMutation` (useSupabaseGalleries.ts)
1. Substituir UPDATEs separados pela nova RPC atômica `reopen_gallery_selection`.
2. RPC além de cancelar pendentes, **também zera `valor_extras` da galeria** (limpa fallback contaminado) e preserva `total_fotos_extras_vendidas`/`valor_total_vendido`.

### F. Backend — defesa em profundidade

**Migration nova:**

```sql
-- 1) RPC atômica de reabertura
CREATE OR REPLACE FUNCTION public.reopen_gallery_selection(
  p_gallery_id uuid, p_days int
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_g RECORD; v_prazo timestamptz;
BEGIN
  SELECT * INTO v_g FROM galerias WHERE id=p_gallery_id FOR UPDATE;
  IF v_g IS NULL THEN RAISE EXCEPTION 'Galeria não encontrada'; END IF;
  IF v_g.user_id <> auth.uid() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  v_prazo := now() + (p_days || ' days')::interval;
  UPDATE galerias SET
    status='selecao_iniciada', status_selecao='em_andamento',
    status_pagamento='sem_vendas', prazo_selecao=v_prazo,
    prazo_selecao_dias=p_days, finalized_at=NULL,
    valor_extras=0,                    -- limpa fallback contaminado
    updated_at=now()
  WHERE id=p_gallery_id;
  -- Cancela cobranças pendentes do ciclo anterior
  UPDATE cobrancas SET status='cancelado', updated_at=now()
   WHERE galeria_id=p_gallery_id AND status='pendente';
  -- Sincroniza sessão
  IF v_g.session_id IS NOT NULL THEN
    UPDATE clientes_sessoes
       SET status_galeria='em_selecao', status_pagamento_fotos_extra='sem_vendas',
           updated_at=now()
     WHERE session_id=v_g.session_id;
  END IF;
  -- Audit
  INSERT INTO galeria_acoes(galeria_id,user_id,tipo,descricao)
    VALUES (p_gallery_id, auth.uid(), 'selecao_reaberta',
            FORMAT('Seleção reaberta (%s dias). Crédito preservado: %s extras / R$ %s',
                   p_days, v_g.total_fotos_extras_vendidas, v_g.valor_total_vendido));
  RETURN jsonb_build_object('success',true,
    'creditos_extras', v_g.total_fotos_extras_vendidas,
    'creditos_valor', v_g.valor_total_vendido);
END $$;

-- 2) Trigger anti-overcharge: bloqueia INSERT de cobrança que excederia o devido
CREATE OR REPLACE FUNCTION public.tg_protect_no_overcharge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_g RECORD; v_pago numeric; v_max numeric; v_extras_necess int;
BEGIN
  IF NEW.galeria_id IS NULL OR COALESCE(NEW.valor,0)<=0 THEN RETURN NEW; END IF;
  IF NEW.tipo_cobranca NOT IN ('foto_extra','link','venda_galeria') THEN RETURN NEW; END IF;
  SELECT * INTO v_g FROM galerias WHERE id=NEW.galeria_id;
  IF v_g IS NULL THEN RETURN NEW; END IF;
  v_extras_necess := GREATEST(0,
    COALESCE(v_g.fotos_selecionadas,0) - COALESCE(v_g.fotos_incluidas,0));
  v_max := v_extras_necess * COALESCE(v_g.valor_foto_extra,0);
  SELECT COALESCE(SUM(valor),0) INTO v_pago
    FROM cobrancas WHERE galeria_id=NEW.galeria_id
      AND status IN ('pago','pago_manual') AND id<>NEW.id;
  IF v_max > 0 AND (v_pago + NEW.valor) > v_max + 0.01 THEN
    RAISE EXCEPTION 'Cobrança excederia o saldo devido. Pago=R$% + Nova=R$% > Max=R$%',
      v_pago, NEW.valor, v_max;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_protect_no_overcharge BEFORE INSERT ON cobrancas
  FOR EACH ROW EXECUTE FUNCTION tg_protect_no_overcharge();
```

### G. Edge function — `confirm-selection`
Adicionar log estruturado quando `extrasACobrar=0 && extrasNecessarias>0` (crédito cobre tudo) — pular criação de cobrança e marcar `status='selecao_completa'` direto. Validar com sanity check `valorTotal === extrasACobrar × valorUnitario`.

## Snippet UI principal (GalleryDetail)

```tsx
const temSaldoNovo = extrasACobrar > 0 && calculatedExtraTotal > 0;
const temCobrancaPendente = !!cobrancaData;
const mostrarCard = temSaldoNovo || temCobrancaPendente;

{mostrarCard && (
  <PaymentStatusCard
    valor={calculatedExtraTotal}        // SEM fallback para valorTotalVendido
    valorPago={valorJaPago}             // só histórico/exibição
    saldoPendente={calculatedExtraTotal}
    extraCount={extrasACobrar}
    cobrancaId={cobrancaData?.id}
    ...
  />
)}
```

## Arquivos modificados

- `src/pages/GalleryDetail.tsx` — condição de exibição + props (2 ocorrências).
- `src/components/PaymentStatusCard.tsx` — exibir crédito anterior informativo, esconder ações se saldo=0.
- `src/components/ClientGalleryHeader.tsx` — nova prop `extrasPagasAnteriormente`, exibir desconto visual.
- `src/components/SelectionSummary.tsx` — bottom-bar mostra `(−X já pagas)`.
- `src/components/SelectionConfirmation.tsx` — destacar saldo, colapsar detalhes do total.
- `src/pages/ClientGallery.tsx` — passar `extrasPagasTotal` ao `ClientGalleryHeader`.
- `src/hooks/useSupabaseGalleries.ts` — `reopenSelectionMutation` chama RPC atômica.
- `supabase/migrations/<novo>.sql` — RPC `reopen_gallery_selection` + trigger `tg_protect_no_overcharge`.
- `supabase/functions/confirm-selection/index.ts` — sanity check + log quando crédito cobre tudo.

**Não tocar:** `infinitepay-create-link`, `infinitepay-webhook`, `finalize_gallery_payment`, contrato compartilhado com Gestão preservado.

## Validação manual

1. Galeria reativada com 2 extras pagas: painel não mostra "Pendente R$ 50".
2. Cliente abre galeria reativada: header mostra "+6 extras (2 já pagas)", bottom-bar mostra `R$ 100` (não R$ 150).
3. Cliente confirma: tela final destaca "Valor a pagar agora: R$ 100" — detalhamento colapsado.
4. Trigger DB: tentativa de inserir cobrança extra que excede saldo é bloqueada com erro claro.
5. Fluxo normal de galeria nova (sem crédito) permanece idêntico.