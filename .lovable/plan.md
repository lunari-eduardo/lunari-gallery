# Plano: Corrigir bug de cobrança duplicada de fotos extras após reativação (InfinitePay)

## Diagnóstico

### Sintoma
Após a galeria "Lucca - 3 meses" (InfinitePay) ser finalizada e paga (1 extra = R$ 25), o fotógrafo reativou para o cliente trocar uma foto. Na nova confirmação, a mesma foto extra **foi cobrada novamente** em vez de ser reconhecida como já paga.

### Causa-raiz identificada (banco de dados)

| Tabela / Campo | Valor atual | Esperado |
|---|---|---|
| `galerias.total_fotos_extras_vendidas` | **0** ❌ | 1 |
| `galerias.valor_total_vendido` | **0** ❌ | 25 |
| `cobrancas.qtd_fotos` (cobrança paga `6e59bacd…`) | **0** ❌ | 1 |
| `cobrancas.extras_contabilizados` | **false** ❌ | true |
| `cobrancas.status` | `pago` ✅ | `pago` |

A RPC `finalize_gallery_payment` exige **`COALESCE(qtd_fotos, 0) > 0`** para incrementar `total_fotos_extras_vendidas`. Como a cobrança foi gravada com `qtd_fotos = 0`, a RPC fez nada → contadores zerados → próximo `confirm-selection` recalcula tudo do zero e cobra de novo.

O **auto-heal preventivo** dentro de `confirm-selection` (linhas 381-417) também filtra por `qtd_fotos > 0`, então não consegue se autocorrigir.

### Por que `qtd_fotos = 0` foi gravado

Levantamento das últimas 20 cobranças InfinitePay mostra padrão claro:

- **Até 27/04** → `qtd_fotos` correto em todas as cobranças.
- **A partir de 28/04** → todas as novas cobranças InfinitePay têm `qtd_fotos = 0`, mas a `descricao` ainda mostra "1 foto extra" corretamente.

Cobranças Asaas no mesmo período permanecem com `qtd_fotos` correto. Isso indica regressão **específica do caminho InfinitePay**.

Análise do código atual:
- `confirm-selection/index.ts:648` envia `qtdFotos: extrasACobrar` ✅ no body para `infinitepay-create-link`.
- `infinitepay-create-link/index.ts:97` desestrutura `qtdFotos` corretamente.
- `infinitepay-create-link/index.ts:223` grava `qtd_fotos: qtdFotos || 0`.
- `gallery-create-payment/index.ts:151` envia `qtdFotos: extraCount` ao chamar `infinitepay-create-link`.
- `PaymentStatusCard` (botão "Cobrar novamente") em `src/pages/GalleryDetail.tsx:876` calcula `extraCount={selectedPhotos.length - fotosIncluidas}` — **não desconta extras já pagos**, e em casos pós-reativação isso é a quantidade total, não "a cobrar".

A ação `cliente_confirmou` da galeria Lucca em 28/04 19:59 (que gerou a cobrança paga `6e59bacd`) sugere que `confirm-selection` foi chamado normalmente — porém `qtd_fotos` saiu como 0. Há uma **possível race** ou perda do parâmetro `qtdFotos` no caminho do `confirm-selection → infinitepay-create-link`. As únicas explicações compatíveis com os dados:

1. O body JSON sendo enviado de `confirm-selection` para `infinitepay-create-link` está perdendo o campo `qtdFotos` (precisa de log + correção defensiva).
2. `extrasACobrar` chega como `0` em alguns cenários, mas a galeria recebe `descricao` com "1 foto extra" baseada em outra variável → confirmação do que ocorreu.

Independente da raiz exata do `0`, **o sistema todo precisa ser blindado** para que `qtd_fotos` reflita a realidade.

## Plano de correção

### Etapa 1 — Correção pontual da galeria "Lucca - 3 meses" (apenas dados)

Reconciliar a galeria já afetada: marcar a cobrança paga como contabilizada e aplicar os contadores na galeria/sessão. Cancelar a 2ª cobrança duplicada que está pendente.

```sql
-- 1.1: Corrigir qtd_fotos da cobrança paga (origem do bug)
UPDATE cobrancas
SET qtd_fotos = 1, updated_at = now()
WHERE id = '6e59bacd-85b6-4ecb-9a93-4535dac4b1f9'
  AND qtd_fotos = 0;

-- 1.2: Disparar a RPC de finalização (idempotente) para sincronizar contadores
SELECT finalize_gallery_payment(
  '6e59bacd-85b6-4ecb-9a93-4535dac4b1f9'::uuid,
  'https://recibo.infinitepay.io/03ce8434-dba3-48b3-9a4d-83f9d2552e8f',
  '2026-04-28 20:02:49.75+00'::timestamptz,
  NULL, NULL
);

-- 1.3: Cancelar a 2ª cobrança duplicada (R$ 25, pendente)
UPDATE cobrancas
SET status = 'cancelado', updated_at = now()
WHERE id = '7d7ebd3b-808d-4759-83e9-813f615f44c4'
  AND status = 'pendente';

-- 1.4: Reverter status da galeria — extras já estão pagos, deve voltar para selecao_completa
UPDATE galerias
SET status_selecao = 'selecao_completa',
    status_pagamento = 'pago',
    finalized_at = COALESCE(finalized_at, now()),
    updated_at = now()
WHERE id = 'f69e5e2d-bd4e-4241-8d12-96fcfe08e35c';
```

### Etapa 2 — Reconciliação retroativa de outras galerias afetadas

Buscar todas as cobranças InfinitePay/MP **pagas** em `qtd_fotos = 0` mas com descrição que revela quantidade ("N foto(s) extra(s)"), e aplicar o mesmo fix.

Migration usa parser regex sobre `descricao` para extrair quantidade — só toca cobranças seguramente identificáveis. Para cada uma:
1. `UPDATE cobrancas SET qtd_fotos = <N>` (extraído da descrição).
2. `SELECT finalize_gallery_payment(id, ...)` para rodar a RPC idempotente.
3. Cancelar quaisquer cobranças duplicadas pendentes da mesma galeria criadas **após** o pagamento.

### Etapa 3 — Blindagem em `finalize_gallery_payment` (RPC)

Tornar a RPC **mais resiliente**: quando `qtd_fotos = 0` mas a `descricao` da cobrança contém um padrão "N foto(s) extra(s)" e `valor > 0`, a RPC tenta inferir `qtd_fotos` da descrição (ou fallback `qtd = ROUND(valor / valor_foto_extra)` com base em `galerias.valor_foto_extra`).

Lógica defensiva — não sobrescreve valores corretos, só preenche zeros:
```sql
IF COALESCE(v_cobranca.qtd_fotos, 0) = 0 AND v_galeria_id IS NOT NULL THEN
  -- Tenta extrair "N foto" da descricao, ou divide valor pelo preço unitário da galeria
  -- Se conseguir, atualiza cobrancas.qtd_fotos antes do INSERT/UPDATE de contadores
END IF;
```

### Etapa 4 — Hardening no `infinitepay-create-link` e `mercadopago-create-link`

- Adicionar **validação obrigatória** no início: se a chamada vem com `galeriaId` mas `qtdFotos == null/0` E `valor > 0`, **logar warning crítico** e tentar inferir `qtdFotos = ROUND(valor / galerias.valor_foto_extra)` antes de gravar.
- Logar o body recebido completo (sem segredos) para rastrear futuras regressões.

### Etapa 5 — Hardening no `confirm-selection`

- **Trocar o filtro do auto-heal** (linha 387) de `.gt('qtd_fotos', 0)` para incluir cobranças `pago/pago_manual` **mesmo com `qtd_fotos = 0`**, deixando a RPC (com a lógica defensiva da Etapa 3) decidir se reconcilia.
- Logar explicitamente `extrasACobrar` antes de cada chamada de payment provider.

### Etapa 6 — Hardening no `PaymentStatusCard` ("Cobrar novamente")

Em `src/pages/GalleryDetail.tsx:876` e `:1107`, trocar:
```tsx
extraCount={selectedPhotos.length - supabaseGallery.fotosIncluidas}
```
por:
```tsx
extraCount={extrasACobrar}  // já calculado descontando extras pagos
```

Isso evita o caso onde, após reativação parcial, o usuário clique "Cobrar novamente" e gere outra cobrança do total ao invés de só do que falta.

## Resultado esperado

- **Galeria Lucca**: contadores corretos, cobrança duplicada cancelada, status volta para `selecao_completa`/`pago`.
- **Outras galerias afetadas**: reconciliadas em lote pela Etapa 2.
- **Futuras reativações**: `qtd_fotos` sempre coerente com a quantidade real cobrada; mesmo se algo na cadeia falhar, a RPC infere o valor pela descrição/preço unitário e a galeria nunca mais cobra duas vezes a mesma foto.

## Arquivos afetados

- **Migrations** (2): correção pontual + reconciliação retroativa.
- **DB**: `finalize_gallery_payment` (RPC) — adicionar fallback de `qtd_fotos`.
- `supabase/functions/infinitepay-create-link/index.ts` — validação defensiva + log.
- `supabase/functions/mercadopago-create-link/index.ts` — validação defensiva + log.
- `supabase/functions/confirm-selection/index.ts` — relaxar filtro do auto-heal + logs.
- `src/pages/GalleryDetail.tsx` — usar `extrasACobrar` no `PaymentStatusCard`.

## Fora do escopo

- Não alterar `asaas-gallery-payment` nem o webhook do Asaas (funcionando corretamente).
- Não alterar a lógica de reativação em `useSupabaseGalleries.ts` (já preserva contadores corretamente — o problema era os contadores estarem zerados na origem).
- Não modificar `infinitepay-webhook` nem o `confirm-payment-manual` (recebem cobrança já criada e usam `qtd_fotos` da cobrança).

## Pergunta antes de executar

Confirma que posso:
1. Cancelar a cobrança pendente duplicada da Lucca (`7d7ebd3b…`) — ela ainda não foi paga, é segura cancelar.
2. Aplicar a Etapa 2 (reconciliação retroativa) em **todas** as outras galerias com cobrança paga InfinitePay/MP que tenham `qtd_fotos = 0` e padrão claro na descrição? Posso primeiro listar quantas galerias seriam afetadas para você validar antes de aplicar.
