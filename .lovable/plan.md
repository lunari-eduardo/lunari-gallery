
# Plano: Corrigir Erro 500 no Pagamento (constraint de tipo_cobranca)

## Problema Raiz Identificado

A Edge Function `mercadopago-create-link` está tentando inserir `'foto_extra'` no campo `tipo_cobranca`, mas o constraint da tabela só permite:

| Valores Permitidos |
|--------------------|
| `'pix'` |
| `'link'` |
| `'card'` |
| `'presencial'` |

**Log de erro:**
```
new row for relation "cobrancas" violates check constraint "cobrancas_tipo_cobranca_check"
Failing row contains (..., tipo_cobranca: 'foto_extra', ...)
```

A função `infinitepay-create-link` já usa `'link'` corretamente, mas a `mercadopago-create-link` usa `'foto_extra'` que é inválido.

---

## Solução

Alterar o valor de `tipo_cobranca` de `'foto_extra'` para `'link'` na função `mercadopago-create-link`, seguindo o mesmo padrão já usado na `infinitepay-create-link`.

---

## Mudança Técnica

### Arquivo: `supabase/functions/mercadopago-create-link/index.ts`

```text
ANTES (linha 88):
┌────────────────────────────────────────────┐
│ tipo_cobranca: 'foto_extra',               │
└────────────────────────────────────────────┘

DEPOIS:
┌────────────────────────────────────────────┐
│ tipo_cobranca: 'link',                     │
└────────────────────────────────────────────┘
```

Isso é consistente com a função `infinitepay-create-link` que já usa `'link'` (linha 198).

---

## Sobre a Lentidão (15 segundos)

A lentidão na abertura da galeria provavelmente está relacionada ao **cold start** das Edge Functions do Supabase. Quando uma função não é usada por um tempo, ela precisa ser "aquecida" novamente na primeira requisição. Logs mostram:

```
booted (time: 26ms)
```

Isso indica que a função em si é rápida, mas o tempo de boot inicial pode variar. Não há alteração de código que resolva isso diretamente - é uma característica da infraestrutura serverless.

---

## Benefícios

1. **Correção imediata**: O pagamento via Mercado Pago funcionará corretamente
2. **Consistência**: Ambas as funções de pagamento usarão o mesmo valor `'link'`
3. **Sem breaking changes**: Não afeta registros existentes

---

## Arquivos a Modificar

1. **`supabase/functions/mercadopago-create-link/index.ts`** (linha 88):
   - Alterar `tipo_cobranca: 'foto_extra'` para `tipo_cobranca: 'link'`
