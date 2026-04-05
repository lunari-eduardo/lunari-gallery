

# Fix: Sessão acumula fotos extras de seleções abandonadas

## Problema

Quando o cliente faz uma seleção, não paga, o fotógrafo reativa a galeria, e o cliente faz uma nova seleção com quantidade diferente de extras:

1. **1ª seleção**: 11 extras → session `qtd_fotos_extra = 11`, `valor_total_foto_extra = R$253`
2. **Reativação**: gallery reseta status, mas session mantém `qtd_fotos_extra = 11`
3. **2ª seleção**: 4 extras → `atomic_update_session_extras` faz `11 + 4 = 15` extras na sessão

Resultado: Gestão mostra 11 extras (da 1ª seleção), valor R$253 "Pago", com R$161 pendente — quando na verdade só foram vendidas 4 extras por R$92.

## Causa raiz

`confirm-selection` usa update **incremental** na sessão (`qtd_fotos_extra += extrasACobrar`), mas quando uma seleção é abandonada sem pagamento, o valor anterior nunca é subtraído. A sessão acumula fantasmas.

A galeria em si não tem esse problema porque usa `total_fotos_extras_vendidas` que só é incrementado no `finalize_gallery_payment` (após pagamento real).

## Solução

### 1. Mudar `confirm-selection` para usar valores absolutos na sessão

Em vez de incrementar (`+= extrasACobrar`), calcular o **total correto** e fazer SET direto:

```
qtd_fotos_extra = gallery.total_fotos_extras_vendidas + extrasACobrar
valor_total_foto_extra = gallery.valor_total_vendido + valorTotal
```

Isso garante que a sessão sempre reflita a realidade: extras já pagas + extras da seleção atual. Se o cliente abandonar e refizer, o valor será sobrescrito corretamente.

### 2. Criar nova RPC `set_session_extras` (substituir `atomic_update_session_extras`)

```sql
CREATE OR REPLACE FUNCTION public.set_session_extras(
  p_session_id TEXT,
  p_total_extras INTEGER,      -- valor absoluto, não incremento
  p_valor_unitario NUMERIC,
  p_total_valor NUMERIC,       -- valor absoluto, não incremento
  p_status_galeria TEXT DEFAULT 'em_selecao'
)
```

Faz `SET qtd_fotos_extra = p_total_extras` em vez de `+= increment`.

### 3. Atualizar `finalize_gallery_payment` para sincronizar sessão com a galeria

Após incrementar `total_fotos_extras_vendidas` e `valor_total_vendido` na galeria, propagar esses valores finais para a sessão:

```sql
UPDATE clientes_sessoes
SET qtd_fotos_extra = (SELECT total_fotos_extras_vendidas FROM galerias WHERE id = v_galeria_id),
    valor_total_foto_extra = (SELECT valor_total_vendido FROM galerias WHERE id = v_galeria_id),
    status_galeria = 'selecao_completa',
    status_pagamento_fotos_extra = 'pago'
WHERE session_id = v_cobranca.session_id;
```

Isso garante que mesmo se houver divergência temporária, ao pagar a sessão será corrigida.

### 4. Backfill da sessão Ayla

Corrigir manualmente a sessão do caso atual:
```sql
UPDATE clientes_sessoes
SET qtd_fotos_extra = 4,
    valor_total_foto_extra = 92
WHERE session_id = (SELECT session_id FROM galerias WHERE id = 'f9e617b4-8968-4f1b-a5fc-8b8301ff94bb');
```

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| Nova migração SQL | Criar RPC `set_session_extras`, atualizar `finalize_gallery_payment` para sincronizar sessão com galeria, backfill Ayla |
| `supabase/functions/confirm-selection/index.ts` | Substituir chamada incremental `atomic_update_session_extras` por `set_session_extras` com valores absolutos |

## Impacto

- Não quebra nenhum fluxo existente (InfinitePay, MercadoPago, Asaas)
- Resolve a divergência entre Gallery e Gestão para qualquer cenário de reativação
- A sessão sempre reflete a realidade da galeria, não importa quantas vezes o cliente refaça a seleção

