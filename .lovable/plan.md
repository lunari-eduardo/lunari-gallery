

# Plano: Resolver ambiguidade de `prepare_gallery_share` no Postgres

## Diagnóstico

Consulta no `pg_proc` confirma que **existem duas versões** coexistindo:

| Assinatura | Origem |
|---|---|
| `prepare_gallery_share(uuid)` | Versão antiga (migrations anteriores) |
| `prepare_gallery_share(uuid, boolean)` | Versão nova criada na última migration |

`CREATE OR REPLACE FUNCTION` no Postgres só substitui a função se a **assinatura for idêntica**. Como adicionamos um parâmetro, criamos uma sobrecarga em vez de substituir — a antiga ficou no banco.

Quando o `SendGalleryModal` chama `supabase.rpc('prepare_gallery_share', { p_gallery_id })` (sem `p_mark_as_sent`), o PostgREST envia uma requisição que casa com **ambas** as funções (a de 1 arg literalmente, e a de 2 args via DEFAULT). Postgres lança:

> `Could not choose the best candidate function between: public.prepare_gallery_share(p_gallery_id => uuid), public.prepare_gallery_share(p_gallery_id => uuid, p_mark_as_sent => boolean)`

Resultado: o botão "Compartilhar" quebra com o modal de erro mostrado na captura.

## Solução

Nova migration que **remove a versão antiga** (1 argumento) e mantém apenas a versão nova (2 argumentos com DEFAULT):

```sql
DROP FUNCTION IF EXISTS public.prepare_gallery_share(uuid);
```

A versão `prepare_gallery_share(uuid, boolean)` continua existindo, e como o segundo parâmetro tem `DEFAULT true`, todas as chamadas existentes continuam funcionando:

- `SendGalleryModal.tsx`: `rpc('prepare_gallery_share', { p_gallery_id })` → resolve para a versão de 2 args usando `p_mark_as_sent = true` (default) → marca como enviada. ✅
- `sendGalleryMutation` (`useSupabaseGalleries.ts` linha 585): idem. ✅
- `publishGalleryMutation`: passa `p_mark_as_sent: false` explicitamente → galeria fica como "Criada". ✅

## Verificação pós-migration

Após aplicar, validar com:

```sql
SELECT oid::regprocedure FROM pg_proc WHERE proname = 'prepare_gallery_share';
-- Deve retornar APENAS: prepare_gallery_share(uuid,boolean)
```

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/<nova>.sql` | `DROP FUNCTION IF EXISTS public.prepare_gallery_share(uuid);` para remover a versão duplicada |

## Resultado esperado

- Erro "Could not choose the best candidate function" desaparece imediatamente.
- Botão "Compartilhar" volta a funcionar e marca a galeria como **"Enviada"**.
- Publicação automática (fim da criação) continua deixando a galeria como **"Criada"** (correção da rodada anterior preservada).
- Nenhuma chamada cliente precisa mudar — a assinatura única `(uuid, boolean DEFAULT true)` cobre todos os casos.

