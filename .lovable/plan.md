

# Plano: Galeria recém-criada deve ficar como "Criada", não "Enviada"

## Diagnóstico

Ao concluir o passo final do criador de galerias (`GalleryCreate.tsx` linha 761 e `DeliverCreate.tsx` linha 255), o código chama `publishGallery(id)` para gerar o `public_token`. O comentário no código diz textualmente: *"Publish gallery (generate token) **without marking as sent**"* — ou seja, a intenção sempre foi separar **publicar** (gerar token, ficar acessível por link) de **enviar** (registrar que o link foi compartilhado com o cliente).

Porém, `publishGallery` chama a RPC `prepare_gallery_share`, que **não respeita essa separação**:

```sql
-- supabase/migrations/20260314175708_*.sql
IF v_gallery.status = 'rascunho' THEN
  v_new_status := 'enviado';   -- ← sempre marca como enviado
END IF;
...
INSERT INTO galeria_acoes (...) VALUES (..., 'enviada', 'Galeria enviada para o cliente')
WHERE NOT EXISTS (...);          -- ← sempre registra ação "enviada"
```

Resultado: ao criar uma galeria, ela aparece imediatamente com badge **"Enviada"** e a timeline já mostra a ação "Galeria enviada para o cliente" — antes de o fotógrafo realmente compartilhar o link.

O envio de verdade acontece em dois pontos legítimos:
1. **`SendGalleryModal`** (botão "Compartilhar"), que também chama `prepare_gallery_share` ao abrir.
2. **`sendSupabaseGallery`** (`useSupabaseGalleries.ts` linha 574), também via RPC.

Ambos precisam continuar marcando como "enviado". O único ponto que **não** deve marcar é a publicação automática no fim da criação.

## Solução

Separar **gerar token** (publicação) de **marcar como enviada** em duas RPCs distintas, mantendo retrocompatibilidade:

### 1. Nova migration: introduzir parâmetro `p_mark_as_sent` na RPC

Atualizar `prepare_gallery_share` para aceitar um segundo parâmetro opcional `p_mark_as_sent boolean DEFAULT true` (mantém comportamento atual para chamadas existentes):

```sql
CREATE OR REPLACE FUNCTION public.prepare_gallery_share(
  p_gallery_id uuid,
  p_mark_as_sent boolean DEFAULT true
) RETURNS json
...
BEGIN
  ...
  -- Só promove status se p_mark_as_sent = true
  v_new_status := v_gallery.status;
  IF p_mark_as_sent AND v_gallery.status = 'rascunho' THEN
    v_new_status := 'enviado';
  END IF;

  UPDATE galerias
  SET
    public_token = v_token,
    published_at = COALESCE(published_at, now()),
    status = v_new_status,
    enviado_em = CASE WHEN v_new_status = 'enviado' THEN COALESCE(enviado_em, now()) ELSE enviado_em END,
    ...

  -- Só registra ação 'enviada' se p_mark_as_sent = true
  IF p_mark_as_sent THEN
    INSERT INTO galeria_acoes (galeria_id, user_id, tipo, descricao)
    SELECT p_gallery_id, v_user_id, 'enviada', 'Galeria enviada para o cliente'
    WHERE NOT EXISTS (
      SELECT 1 FROM galeria_acoes WHERE galeria_id = p_gallery_id AND tipo = 'enviada'
    );
  END IF;
  ...
END;
```

Compatibilidade preservada:
- `SendGalleryModal` (linha 66) chama sem o segundo arg → `true` por default → continua marcando como enviada. ✅
- `sendGalleryMutation` (linha 585) idem. ✅
- `publishGalleryMutation` será atualizado para passar `false` (ver abaixo).

### 2. Atualizar `publishGalleryMutation` em `useSupabaseGalleries.ts`

Passar `p_mark_as_sent: false` na chamada da RPC (linhas 549-551):

```ts
const { data, error } = await supabase.rpc('prepare_gallery_share', {
  p_gallery_id: id,
  p_mark_as_sent: false,
});
```

Isso faz com que `publishGallery`:
- Gere o `public_token` (galeria fica acessível por link). ✅
- **Não** mude `status` de `rascunho` para `enviado`.
- **Não** insira ação `'enviada'` na timeline.

### 3. Regenerar tipos do Supabase

Após a migration, os tipos em `src/integrations/supabase/types.ts` serão regenerados automaticamente para refletir a nova assinatura `{ p_gallery_id: string; p_mark_as_sent?: boolean }`.

## Resultado esperado

- Após concluir a criação no `GalleryCreate` ou `DeliverCreate`:
  - Galeria fica com status **"Criada"** (badge cinza, ícone círculo).
  - Token público é gerado (link funciona se compartilhado).
  - Timeline mostra apenas **"Galeria criada"**.
- Ao clicar em **"Compartilhar"** (`SendGalleryModal`) ou ação de envio:
  - Status muda para **"Enviada"** (badge azul, ícone Send).
  - Timeline ganha **"Galeria enviada para o cliente"**.
  - `enviado_em` é preenchido.
- Nenhuma chamada existente quebra (default do parâmetro mantém comportamento antigo para os outros chamadores).

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/<nova>.sql` | Recria `prepare_gallery_share` com novo parâmetro `p_mark_as_sent boolean DEFAULT true`; promoção de status e log de ação ficam condicionados ao parâmetro |
| `src/hooks/useSupabaseGalleries.ts` | `publishGalleryMutation` passa `p_mark_as_sent: false` na RPC |
| `src/integrations/supabase/types.ts` | Regeneração automática dos tipos da função |

