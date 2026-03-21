

# Diagnóstico: Galerias Pagas mas com Status "Pendente"

## Causa Raiz (confirmada com dados)

Encontrei **4 galerias afetadas** (Roberta Tomaz, Agatha 5 meses, Cecília Smash, Aurora Páscoa) — todas InfinitePay, todas com cobranças `status = 'pago'` com comprovante, mas galeria `status_pagamento = 'pendente'`.

**Dois problemas encadeados:**

1. **`galeria_id = NULL` nas cobranças**: O deploy do Gestão sobre `infinitepay-create-link` removeu o campo `galeriaId` da inserção. Nosso redeploy corrigiu o código, mas as cobranças criadas no período já foram inseridas sem `galeria_id`.

2. **Armadilha de idempotência na RPC**: A migration que corrigiu a RPC (`finalize_gallery_payment`) adicionou o fallback session_id, mas as cobranças já tinham sido processadas pela versão ANTIGA da RPC (sem fallback). Agora, ao tentar "Confirmar Pago", a RPC vê `status = 'pago'` e retorna `already_paid = true` **sem verificar se a galeria foi atualizada**. Resultado: a galeria fica permanentemente travada em `pendente`.

3. **`qtd_fotos = 0`**: O deploy do Gestão também removeu o campo `qtdFotos` da inserção na cobrança. Mesmo que corrijamos o status, o incremento atômico de fotos extras na RPC soma 0.

## Plano de Correção

### 1. Corrigir a armadilha de idempotência na RPC

Alterar o bloco `already_paid` para **não retornar imediatamente**. Em vez disso, verificar se a galeria associada ainda precisa ser atualizada:

```sql
IF v_cobranca.status = 'pago' THEN
  -- Resolve galeria_id if missing
  v_galeria_id := v_cobranca.galeria_id;
  IF v_galeria_id IS NULL AND v_cobranca.session_id IS NOT NULL THEN
    SELECT id INTO v_galeria_id FROM galerias
    WHERE session_id = v_cobranca.session_id LIMIT 1;
    IF v_galeria_id IS NOT NULL THEN
      UPDATE cobrancas SET galeria_id = v_galeria_id WHERE id = p_cobranca_id;
    END IF;
  END IF;

  -- Check if gallery still needs update
  IF v_galeria_id IS NOT NULL THEN
    PERFORM 1 FROM galerias
    WHERE id = v_galeria_id AND status_pagamento != 'pago';
    IF FOUND THEN
      -- Gallery out of sync — apply updates
      UPDATE galerias SET status_pagamento = 'pago', status_selecao = 'selecao_completa',
        finalized_at = COALESCE(finalized_at, v_cobranca.data_pagamento)
      WHERE id = v_galeria_id;
      UPDATE clientes_sessoes SET status_galeria = 'selecao_completa',
        status_pagamento_fotos_extra = 'pago' WHERE session_id = v_cobranca.session_id;
      RETURN jsonb_build_object('success', true, 'already_paid', true,
        'gallery_synced', true, 'galeria_id', v_galeria_id);
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'already_paid', true);
END IF;
```

Isso garante que "Confirmar Pago" **sempre sincronize a galeria**, mesmo que a cobrança já esteja paga.

### 2. Corrigir dados das 4 galerias afetadas (na mesma migração)

- Vincular `galeria_id` nas cobranças órfãs via session_id
- Atualizar as galerias: `status_pagamento = 'pago'`, `status_selecao = 'selecao_completa'`, `finalized_at = cobranca.data_pagamento`
- Atualizar `clientes_sessoes` correspondentes

### 3. Prevenir regressão futura

O `qtd_fotos = 0` nas cobranças é um problema menor agora (os valores de `valor_extras` já estão corretos na galeria via `confirm-selection`), mas devemos garantir que o campo seja sempre salvo. Isso já está correto no nosso código atual — o problema foi apenas o deploy do Gestão.

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| Nova migração SQL | Atualizar RPC (corrigir armadilha idempotência) + corrigir 4 galerias afetadas |

## Resultado esperado

- As 4 galerias passam imediatamente a `status_pagamento = 'pago'`
- "Confirmar Pago" nunca mais deixa galeria dessincronizada, mesmo para cobranças já pagas
- Fotógrafos podem usar "Confirmar Pago" como chave mestra confiável em qualquer cenário

